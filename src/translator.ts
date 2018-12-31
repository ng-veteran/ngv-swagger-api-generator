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
        arr: input.replace(/\s*«\s*/g, ' < ').replace(/\s*»\s*/g, ' >').replace(/\s*,\s*/g, ' , ').split(' '),
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
    const name = this.toInterfaceName(input.title);
    const [, generics] = this.parseGenerics(input.title);
    let properties = new Array()
    if (isNullOrUndefined(input.properties)) {
      properties.push(`  [key: string]: any;`);
    } else {
      properties.push(
        ...Object.keys(input.properties).map(key => {
          return this.toProperty(input.properties[key], key, imports, generics);
        })
      );
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

  toProperty(input: SwaggerProperty, inputName: string, imports: string[], genericTypes: string[]): string {
    return [
      `  /**`,
      `   * ${input.description}`,
      `   */`,
      `  ${inputName}${input.allowEmptyValue ? '?' : ''}: ${this.toPropertyType(input, imports, genericTypes)};`
    ].join('\n');
  }

  toPropertyType(input: SwaggerProperty, imports: string[], genericTypes: any[]): string {
    if (['integer', 'double', 'float', 'number'].includes(input.type)) {
      return 'number';
    } else if (['string', 'boolean'].includes(input.type)) {
      return input.type;
    } else if (['object'].includes(input.type)) {
      return 'any';
    } else if (['Map'].includes(input.type)) {
      return '{[key: string]: any}';
    } else if (['array', 'List'].includes(input.type)) {
      const itemType = this.toPropertyType(input.items, imports, genericTypes);
      return `Array<${itemType}>`;
    } else if (input.$ref) {
      const [, name] = /#\/definitions\/([^\/]*)$/.exec(input.$ref) as string[];

      const [className, classGenerics] = this.parseGenerics(name);

      let result: string | null = null;

      const compare = (name: string, generics: any[], name1: string, generics1: any[]): boolean => {
        if (name === name) {
          if (generics === undefined && generics === generics1) {
            return true;
          } else if (isArray(generics) && isArray(generics1)) {
            for (let i = 0; i < generics.length; i++) {
              const { childName, childGenerics } = generics[i];
              const { childName1, childGenerics1 } = generics1[i];
              if (!compare(childName, childGenerics, childName, childGenerics1)) {
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

      if (isArray(genericTypes)) {
        genericTypes.forEach(([name, generics], index: number) => {
          if (compare(name, generics, className, classGenerics)) {
            result = `T${index}`;
          }
        });
      }

      if (result === null) {
        this.toImport(name).filter(str => !imports.includes(str)).forEach(str => imports.push(str));
        return this.toTypeName(name);
      } else {
        return result;
      }


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
