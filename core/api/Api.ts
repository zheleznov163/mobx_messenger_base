import { guid, Logger } from "utils";
import ErrorHandler, { IHandler } from "utils/ErrorHandler";

class Api {
  readonly LEGACY = "example://";
  readonly PROD = "example.ru/";
  readonly DEV = "test-example.ru/";
  readonly localhost = "http://localhost:3000/";

  baseUrl = `https://${this.PROD}`;

  private config = {
    headers: {
      "content-type": "application/json",
    },
  };
  private errors = new ErrorHandler();

  // eslint-disable-next-line no-undef
  async fetch<T extends object>(url: string, init?: RequestInit): Promise<T> {
    const route = this.baseUrl + url;
    const request = {
      ...init,
      headers: {
        ...this.config.headers,
        "request-id": guid(),
        ...(init?.headers ? init.headers : {}),
      },
    };
    // console.log(Logger.curl(route, request))
    try {
      const response = await fetch(route, request);
      const body = await response.text();
      let parsed;
      if (body) {
        parsed = JSON.parse(body);
      }
      return parsed;
    } catch (error: unknown) {
      this.errors.trackError(route)(error);
      throw error;
    }
  }

  getQueryParameters = <T extends object>(options?: T) => {
    const getParam = (key: string, value: string) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;

    const getSymbol = (query: string) => (query.length === 0 ? "?" : "&");

    return !options
      ? ""
      : Object.keys(options).reduce((query, key) => {
          // @ts-ignore
          const value = options[key];
          if (value !== undefined) {
            query += `${getSymbol(query)}${getParam(key, value)}`;
          }
          return query;
        }, "");
  };

  fixLink<T extends string | undefined>(link: T): T {
    if (link === undefined) {
      return undefined as T;
    }
    // @ts-ignore
    if (/^https?/.test(link)) {
      return link as T;
    }
    if (link[0] === "/") {
      return (this.baseUrl + link.slice(1)) as T;
    }
    return (this.baseUrl + link) as T;
  }

  configure(prod: boolean, handler?: IHandler<string>, headers?: object) {
    if (prod) {
      this.baseUrl = `https://${this.PROD}`;
    } else {
      this.baseUrl = `https://${this.DEV}`;
    }

    if (headers) {
      this.config = {
        headers: {
          "content-type": "application/json",
          ...headers,
        },
      };
    }
    handler && this.errors.setHandlers([handler]);
  }
}

const api = new Api();
export default api;
