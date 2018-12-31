import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { from, throwError } from 'rxjs';
import { mergeMap, tap, catchError } from 'rxjs/operators';
import { Swagger } from './interface/swagger';
import { SwaggerDefinition } from './interface/swagger-definition';
import { Translator } from './translator';
import fetch from 'node-fetch';

export class Generator {

  translator = new Translator();

  constructor() {


  }

  generate(uri: string, output: string) {
    from(fetch(uri))
      .pipe(
        mergeMap(resp => from(resp.json())),
        mergeMap((api: Swagger) => {
          const definitions = new Array<SwaggerDefinition>();
          Object.keys(api.definitions)
            .filter((key) => !/^(Map|List)«[\s\S]*»$/g.test(key))
            // .filter(key => key === 'HttpResponse«Page«Version»»')
            .forEach((key) => {
              definitions.push(api.definitions[key]);
            });
          return from(definitions);
        }),
        tap(definition => {
          console.log(`\n=============================================================================`)
          console.log(`==genearate ${definition.title} ...`)
          const filename = this.translator.toInterfaceFileName(definition.title);
          const content = this.translator.toInterface(definition);

          if (!existsSync(output)) {
            mkdirSync(output, { recursive: false });
          }

          console.log(`==write ${output}/${filename}...`)
          writeFileSync(`${output}/${filename}.ts`, content);
          console.log(`${content}`);
          console.log(`=====================================ok=====================================`);
        }),
        catchError((error) => {
          console.error(error);
          return throwError(error);
        })
      )
      .subscribe();
  }

}
