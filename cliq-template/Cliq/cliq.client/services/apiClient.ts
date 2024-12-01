import { Client} from 'services/generated/generatedClient'
import getEnvVars from 'env'

export class ApiClient {
    // TODO: Figure out how to resolve dev vs prod env
    // TODO: Pass auth data here
    static Instance: Client = new Client(getEnvVars('development').API_URL);
}