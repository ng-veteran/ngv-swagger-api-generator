import { SwaggerProperty } from './swagger-property';

export interface SwaggerDefinition {
  /**
   * 模型描述
   */
  description?: string;
  /**
   * 模型标题
   */
  title?: string;

  /**
   * 必填属性列表
   */
  required?: string[];

  /**
   * 属性列表
   */
  properties?: {
    [key: string]: SwaggerProperty
  }

  type?: string;
}
