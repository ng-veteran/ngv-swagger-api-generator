import { isNullOrUndefined, isNull, isUndefined, isArray, isString, isObject } from "util";
import { SwaggerDefinition } from "./interface/swagger-definition";
import { SwaggerProperty } from "./interface/swagger-property";

export class Translator {

  dir = '.';
  interfacePrefix = 'Api';

  parseGenerics(input: string | { arr: string[], index: number }): any[] {
    let inputObj: { arr: string[], index: number };
    if (isString(input)) {
      inputObj = {
        arr: input.replace(/\s*«\s*/g, ' < ').replace(/\s*»\s*/g, ' >').replace(/\s*,\s*/g, ' , ').split(' ').map(item => {
          const jsType = this.toJsValueType(item);
          if (jsType === 'any') {
            return item;
          } else {
            return jsType;
          }
        }),
        index: 0
      }
    } else {
      inputObj = input;
    }

    const output: any[] = [];
    for (; inputObj.index < inputObj.arr.length; inputObj.index++) {
      const element = inputObj.arr[inputObj.index];
      if (!['<', '>', ','].includes(element)) {
        if (inputObj.index === 0) {
          output.push(element);
        } else {
          output.push([element]);
        }
      } else if (element === '<') {
        let _output = output[output.length - 1];
        if (inputObj.index === 1) {
          _output = output;
        }
        inputObj.index++;
        const child = this.parseGenerics(inputObj);
        _output.push(child);
      } else if (element === '>') {
        return output;
      }
    }
    return output;
  }


  toInterfaceFileName(input: string): string {
    const interfaceName = this.toInterfaceName(input);
    const [, name] = /^([^<]+)(<[^<]+>)?$/g.exec(interfaceName) as string[];

    let fileName = ``;

    name.split('').forEach((char, index) => {
      if (/[A-Z]/.test(char)) {
        fileName += `${index > 0 ? '-' : ''}${char.toLowerCase()}`;
      } else {
        fileName += char;
      }
    });

    return `${fileName}`;
  }

  toInterfaceName(input: string): string {
    const [className, generics] = this.parseGenerics(input) as [string, string[]];

    let output = `${this.interfacePrefix}${className}`;

    if (isNullOrUndefined(generics)) {
      return output;
    }


    generics.forEach((generic, i, arr) => {
      if (i === 0) {
        output += '<';
      }

      output += `T${i}`;

      if (i + 1 === arr.length) {
        output += '>';
      } else {
        output += ',';
      }
    });

    return output;
  }


  toTypeName(input: string | [string, any[]]) {
    if (isString(input)) {
      input = this.parseGenerics(input) as [string, any[]];
    }
    const [className, generices] = input;
    let str = `${this.interfacePrefix}${className}`;
    if (isArray(generices)) {
      str += `<${
        generices.map(generice => {
          return this.toTypeName(generice);
        }).join(',')
        }>`;
    }
    return str;
  }


  toInterface(input: SwaggerDefinition): string {
    const imports = new Array<string>();
    const name = this.toInterfaceName(input.title as string);
    const [, generics] = this.parseGenerics(input.title as string);
    let properties = new Array()
    if (input.properties) {
      properties.push(
        ...Object.keys(input.properties).map(key => {
          return this.toProperty((input.properties as { [key: string]: SwaggerProperty })[key], key, imports, generics);
        })
      );
    } else {
      properties.push(`  [key: string]: any;`);
    }
    return [
      ...imports,
      ``,
      `/**`,
      ` * ${input.description}`,
      ` */`,
      `export interface ${name} {`,
      ...properties,
      `}`,
      ``
    ].join('\n');
  }

  toProperty(input: SwaggerProperty, inputName: string, imports: string[], genericTypes: any[]): string {
    return [
      `  /**`,
      `   * ${input.description}`,
      `   */`,
      `  ${inputName}${input.allowEmptyValue ? '?' : ''}: ${this.toPropertyType(input, imports, genericTypes)};`
    ].join('\n');
  }

  toPropertyType(input: SwaggerProperty, imports: string[], genericTypes: any[]): string {
    let result: string | null = null;
    if (input.$ref) {
      const [, name] = /#\/definitions\/([^\/]*)$/.exec(input.$ref) as string[];

      const [className, classGenerics] = this.parseGenerics(name);

      // 查找class泛型参数
      if (genericTypes instanceof Array) {
        result = this.toGenericType(genericTypes, className);
      }

      if (result === null) {
        // 增加依赖导致
        this.toImport(name).filter(str => !imports.includes(str)).forEach(str => imports.push(str));
        result = this.toTypeName(name);
      }

    } else {
      const type = this.toJsValueType(input.type);

      // 查找class泛型参数
      if (isArray(genericTypes)) {
        result = this.toGenericType(genericTypes, type)
      }

      if (result === null) {
        if (type === 'Array' && input.items) {
          result = `Array<${this.toPropertyType(input.items, imports, genericTypes)}>`;
        } else {
          result = type;
        }
      }
    }

    return result;
  }


  toGenericType(genericTypes: any[], className: any) {
    let result: string | null = null;
    genericTypes.forEach(([name], index: number) => {
      if (name === className) {
        result = `T${index}`;
      }
    });
    return result;
  }

  compare(name: string, generics: any[], name1: string, generics1: any[]): boolean {
    if (name === name) {
      if (generics === undefined && generics === generics1) {
        return true;
      } else if (isArray(generics) && isArray(generics1)) {
        for (let i = 0; i < generics.length; i++) {
          const { childName, childGenerics } = generics[i];
          const { childName1, childGenerics1 } = generics1[i];
          if (!this.compare(childName, childGenerics, childName, childGenerics1)) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    }
    return false;
  };

  toJsValueType(apiType?: string) {
    if (apiType === undefined) {
      return 'any';
    } else if (['integer', 'double', 'float', 'number', 'int'].includes(apiType)) {
      return 'number';
    } else if (['string', 'boolean'].includes(apiType)) {
      return apiType;
    } else if (['object'].includes(apiType)) {
      return 'any';
    } else if (['Map'].includes(apiType)) {
      return '{[key: string]: any}';
    } else if (['array', 'List'].includes(apiType)) {
      return `Array`;
    } else {
      return 'any';
    }
  }

  toImport(input: string | Array<any>): string[] {

    const output = new Array<string>();
    if (isString(input)) {
      input = this.parseGenerics(input) as [string, any[]];
    }

    const [name, generics] = input;

    if (['string', 'number', 'Map', 'Array', 'object'].includes(name)) {
      return output;
    }

    const typeName = `${this.interfacePrefix}${name}`;
    const typePath = `${this.dir}/${this.toInterfaceFileName(name)}`;
    const importStr = `import { ${typeName} } from '${typePath}';`;

    if (!output.includes(importStr)) {
      output.push(importStr);
    }

    if (isArray(generics)) {
      generics.forEach((generic: any) => {
        this.toImport(generic).filter(str => !output.includes(str)).forEach(str => {
          output.push(str);
        });
      });
    }
    return output;
  }
}
