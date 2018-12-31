import { SwaggerDefinition } from "./swagger-definition";

export interface Swagger {
  info: {
    title: string;
    version: string;
    description: string;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;

  paths: {
    [key: string]: {

    };
  };

  definitions: {
    /**
     * 数据模型
     */
    [key: string]: SwaggerDefinition;
  }
};
