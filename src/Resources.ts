import RestProvider from "./data-providers/RestProvider";
import axios, {AxiosInstance} from "axios";
import Schema from "./Schema";
import Ajv from "ajv";


export default class Resources {
    constructor(
        private http: AxiosInstance = axios,
        private ajv: Ajv = new Ajv(),
    ) {
    }

    create<T extends object>(name: string) {
        let schema: Schema<T>;
        if (this.ajv.getSchema(name)) {
            schema = new Schema<T>(this.ajv, name)
        } else {
            schema = new Schema<T>();
        }
        return new RestProvider<T>(`/${name}`, this.http, schema)
    }
}
