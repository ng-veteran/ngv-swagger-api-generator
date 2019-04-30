import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { from, throwError, queueScheduler } from 'rxjs';
import { mergeMap, tap, catchError, map } from 'rxjs/operators';
import { Swagger } from './interface/swagger';
import { Translator } from './translator';
import fetch from 'node-fetch';
import ProgressBar from 'progress'
export class Generator {

  translator = new Translator();

  constructor() {
  }

  generate(uri: string, output: string) {
    from(fetch(uri))
      .pipe(
        mergeMap(resp => resp.json()),
        map((api: Swagger) => Object.keys(api.definitions)
          .filter((key) => !/^(Map|List)«[\s\S]*»$/g.test(key))
          .map((key) => {
            return api.definitions[key];
          })
          .filter(definition => definition.title !== undefined)
        ),
        tap(definitions => {
          const bar = new ProgressBar('[:current/:total][:bar] :progress ', definitions.length);

          definitions.forEach((definition, index) => {
            try {
              bar.render({
                progress: `genearate ${definition.title} ...`
              });

              const filename = this.translator.toInterfaceFileName(definition.title as string);
              const content = this.translator.toInterface(definition);
              const outputFile = `${output}/${filename}.ts`;

              if (!existsSync(output)) {
                mkdirSync(output, { recursive: false });
              }

              bar.render({
                progress: `write ${outputFile}...`
              });

              if (existsSync(outputFile) && readFileSync(outputFile).toString() === content) {
                bar.render({
                  progress: `${outputFile} already exists and unchanged`
                });
              } else {
                writeFileSync(outputFile, content);
                bar.render({
                  progress: `write ${outputFile} ok`
                });
                console.log(`\n write ${definition.title} \n ${outputFile} \n${content}`);
              }

              if (index + 1 === definitions.length) {
                bar.render({
                  progress: `done`
                });
              }
            } catch (error) {
              console.error(error);
            } finally {
              bar.tick();
            }
          });
        })
      )
      .subscribe();
  }

}
