// src/types/errors.ts
import { AxiosError } from 'axios';

export interface APIErrorResponse {
  message: string;
  details?: any;
  status?: number;
}

export type APIError = AxiosError<APIErrorResponse>;

export const isAPIError = (error: any): error is APIError => {
  return error?.isAxiosError === true;
};

