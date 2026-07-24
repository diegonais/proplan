import axios from 'axios';

import { env } from '../../utils/env';

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'X-Time-Zone': env.timeZone,
  },
});
