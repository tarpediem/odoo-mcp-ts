import xmlrpc from 'xmlrpc';
import type { OdooConnectionConfig } from './config.js';

export interface TimesheetSearchFilters {
  employeeId?: number;
  taskId?: number;
  projectId?: number;
  date?: string;
  descriptionContains?: string;
}

export interface TimesheetUpdateInput {
  description?: string;
  projectId?: number;
  taskId?: number;
  unitAmountHours?: number;
  date?: string;
}

export interface TimesheetCreateInput extends TimesheetUpdateInput {
  employeeId: number;
  date: string;
  description: string;
  unitAmountHours: number;
}

export interface TimesheetRecord {
  id: number;
  name: string;
  date: string;
  employee_id: [number, string] | false;
  project_id: [number, string] | false;
  task_id: [number, string] | false;
  unit_amount: number;
}

const TIMESHEET_FIELDS = ['id', 'name', 'date', 'employee_id', 'project_id', 'task_id', 'unit_amount'];

type XmlRpcClient = ReturnType<typeof xmlrpc.createClient>;

const COMMON_PATH = '/xmlrpc/2/common';
const OBJECT_PATH = '/xmlrpc/2/object';

function createXmlRpcClient(baseUrl: string, path: string): XmlRpcClient {
  const url = new URL(path, baseUrl);
  const clientOptions = { url: url.toString() };
  if (url.protocol === 'https:') {
    return xmlrpc.createSecureClient(clientOptions);
  }
  return xmlrpc.createClient(clientOptions);
}

function callMethod<T>(client: XmlRpcClient, method: string, params: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    client.methodCall(method, params, (err: unknown, value: T) => {
      if (err) {
        if (err instanceof Error) {
          reject(err);
        } else {
          reject(new Error(`XML-RPC call failed for ${method}: ${JSON.stringify(err)}`));
        }
        return;
      }
      resolve(value);
    });
  });
}

export class OdooClient {
  private readonly commonClient: XmlRpcClient;
  private readonly objectClient: XmlRpcClient;
  private uid: number | null = null;

  constructor(private readonly config: OdooConnectionConfig) {
    this.commonClient = createXmlRpcClient(config.baseUrl, COMMON_PATH);
    this.objectClient = createXmlRpcClient(config.baseUrl, OBJECT_PATH);
  }

  async authenticate(): Promise<number> {
    const uid = await callMethod<number | false>(this.commonClient, 'authenticate', [
      this.config.database,
      this.config.username,
      this.config.password,
      {}
    ]);

    if (uid === false) {
      throw new Error('Failed to authenticate with Odoo; check credentials and permissions.');
    }

    this.uid = uid;
    return uid;
  }

  private async ensureAuthenticated(): Promise<number> {
    if (this.uid !== null) {
      return this.uid;
    }
    return this.authenticate();
  }

  private async executeKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>
  ): Promise<T> {
    const uid = await this.ensureAuthenticated();
    return callMethod<T>(this.objectClient, 'execute_kw', [
      this.config.database,
      uid,
      this.config.password,
      model,
      method,
      args,
      kwargs ?? {}
    ]);
  }

  async findTimesheets(filters: TimesheetSearchFilters, limit = 20): Promise<TimesheetRecord[]> {
    const domain: Array<[string, string, unknown]> = [];
    if (typeof filters.employeeId === 'number') {
      domain.push(['employee_id', '=', filters.employeeId]);
    }
    if (typeof filters.projectId === 'number') {
      domain.push(['project_id', '=', filters.projectId]);
    }
    if (typeof filters.taskId === 'number') {
      domain.push(['task_id', '=', filters.taskId]);
    }
    if (filters.date) {
      domain.push(['date', '=', filters.date]);
    }
    if (filters.descriptionContains) {
      domain.push(['name', 'ilike', filters.descriptionContains]);
    }

    return this.executeKw<TimesheetRecord[]>('account.analytic.line', 'search_read', [domain, TIMESHEET_FIELDS], {
      limit,
      order: 'date desc'
    });
  }

  async updateTimesheet(timesheetId: number, payload: TimesheetUpdateInput): Promise<boolean> {
    const values: Record<string, unknown> = {};
    if (payload.description !== undefined) {
      values.name = payload.description;
    }
    if (payload.projectId !== undefined) {
      values.project_id = payload.projectId;
    }
    if (payload.taskId !== undefined) {
      values.task_id = payload.taskId;
    }
    if (payload.unitAmountHours !== undefined) {
      values.unit_amount = payload.unitAmountHours;
    }
    if (payload.date !== undefined) {
      values.date = payload.date;
    }

    if (Object.keys(values).length === 0) {
      throw new Error('No fields provided to update the timesheet.');
    }

    return this.executeKw<boolean>('account.analytic.line', 'write', [[timesheetId], values]);
  }

  async createTimesheet(payload: TimesheetCreateInput): Promise<number> {
    const values: Record<string, unknown> = {
      name: payload.description,
      date: payload.date,
      employee_id: payload.employeeId,
      unit_amount: payload.unitAmountHours
    };

    if (payload.projectId !== undefined) {
      values.project_id = payload.projectId;
    }
    if (payload.taskId !== undefined) {
      values.task_id = payload.taskId;
    }

    const id = await this.executeKw<number>('account.analytic.line', 'create', [values]);
    return id;
  }

  async getTimesheet(timesheetId: number): Promise<TimesheetRecord | null> {
    const result = await this.executeKw<TimesheetRecord[]>('account.analytic.line', 'read', [[timesheetId], TIMESHEET_FIELDS]);
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }
    return result[0];
  }
}
