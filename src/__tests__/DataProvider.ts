import {RestProvider} from "../DataProvider";
import Axios from "axios";

describe('DataProvider', () => {
    it('RestProvider', () => {

        const http = Axios.create()
        const ds = new RestProvider('/api', http);
    });
});
