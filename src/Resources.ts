import RestProvider from './data-providers/RestProvider';
import axios, { AxiosInstance } from 'axios';
import Schema from './Schema';
import Ajv from 'ajv';

export default class Resources {
  constructor(
    private http: AxiosInstance = axios,
    private ajv: Ajv = new Ajv()
  ) {}

  create<T extends Record<string, any> = Record<string, any>>(path: string, pathValues?: string | number | Record<string, string | number>) {
    let schema: Schema<T>;
    if (this.ajv.getSchema(path)) {
      schema = new Schema<T>(this.ajv, path);
    } else {
      schema = new Schema<T>();
    }

    if (pathValues && typeof pathValues !== 'object') {
      pathValues = {id: pathValues}
    }

    Object.entries(pathValues || {}).forEach(([key, value]) => {
      path = path.replace('{' + key +'}', String(value))
    })
    return new RestProvider<T>(`/${path}`, this.http, schema);
  }
}
