import chai, { should, use } from 'chai';
import Sinon, { spy, stub } from 'sinon';
import sinonChai = require('sinon-chai');

should();
use(sinonChai);

import { Translator } from "./translator";
import { SwaggerProperty } from './interface/swagger-property';

describe('Translator', () => {
  let translator: Translator;

  beforeEach(() => {
    translator = new Translator();
  });

  describe('#parseGenerics ', () => {
    it('应该解析"User"成功', () => {

      const input = "User";
      const expected = ['User'];
      const result = translator.parseGenerics(input);

      result.should.to.deep.equal(expected);

    });

    it('应该解析"Page«TransferRecordRes»"成功', () => {
      const input = "Page«TransferRecordRes»";
      const expected = [
        'Page',
        [
          ['TransferRecordRes']
        ]
      ];
      const result = translator.parseGenerics(input);
      result.should.to.deep.equal(expected, '解析泛型参数类型');
    });

    it('应该解析"Page«TransferRecordRes«User,Summary»»"', () => {
      const input = 'Page«TransferRecordRes«User,Summary»»';
      const expected = [
        'Page',
        [
          [
            'TransferRecordRes',
            [
              ['User'],
              ["Summary"]
            ]
          ]
        ]
      ];

      const result = translator.parseGenerics(input);

      result.should.to.deep.equal(expected);
    });


    it('应该解析"Page«TransferRecordRes«User,Summary»,TransferRecordRes1«User1,Summary1»»"', () => {
      const input = 'Page«TransferRecordRes«User,Summary»,TransferRecordRes1«User1,Summary1»»';
      const expected = [
        'Page',
        [
          ['TransferRecordRes', [['User'], ["Summary"]]],
          ['TransferRecordRes1', [['User1'], ["Summary1"]]]
        ]
      ];

      const result = translator.parseGenerics(input);

      result.should.to.deep.equal(expected);
    });
  });

  describe('#toInterfaceFileName', () => {
    it('应该转换ActivityPackageDetailRes为api-activity-package-detail-res.ts', () => {
      const input = 'ActivityPackageDetailRes';
      const expected = 'api-activity-package-detail-res';
      const stubToInterfaceName = stub(translator, 'toInterfaceName')
        .withArgs(input)
        .returns('ApiActivityPackageDetailRes');
      const result = translator.toInterfaceFileName(input);
      stubToInterfaceName.should.to.have.been.calledOnce;
      result.should.to.be.equal(expected);
    });

    it('应该转换HttpResponse«ActivityDetailRes»为api-http-response.ts', () => {
      const input = 'HttpResponse«ActivityDetailRes»';
      const expected = 'api-http-response';
      const stubToInterfaceName = stub(translator, 'toInterfaceName')
        .withArgs(input)
        .returns('ApiHttpResponse<T0>');
      const result = translator.toInterfaceFileName(input);
      stubToInterfaceName.should.to.have.been.calledOnce;
      result.should.to.be.eq(expected);
    });
  });

  describe('#toInterfaceName', () => {

    it('应该转换"User"为"ApiUser"', () => {
      const input = "User";
      const expected = "ApiUser";

      const stubParseGenerics = stub(translator, 'parseGenerics')
        .withArgs(input)
        .returns(['User']);

      const result = translator.toInterfaceName(input);

      stubParseGenerics.should.to.have.been.calledOnce;
      result.should.to.be.eq(expected);
    });

    it('应该转换"Page«TransferRecordRes»"为"ApiPage<ApiTransferRecordRes>"', () => {
      const input = "Page«TransferRecordRes,User»";
      const expected = "ApiPage<T0,T1>";

      const stubParseGenerics = stub(translator, 'parseGenerics')
        .withArgs(input)
        .returns(['Page', [
          ['TransferRecordRes'],
          ['User']
        ]]);

      const result = translator.toInterfaceName(input);

      stubParseGenerics.should.to.have.been.calledOnce

      result.should.to.be.eq(expected);
    });

  });


  describe('#toPropertyType', () => {

    it('应该可以转换数值类型属性', () => {
      const imports = new Array<string>();
      const input1: SwaggerProperty = {
        format: "int32",
        type: "integer"
      } as any;

      const execpted = 'number';

      const result1 = translator.toPropertyType(input1, imports, []);

      result1.should.to.be.equal(execpted, 'integer');

      const input2: SwaggerProperty = {
        allowEmptyValue: false,
        description: "宝盒价值，用于宝盒",
        format: "double",
        type: "number"
      } as any;

      const result2 = translator.toPropertyType(input2, imports, []);

      result2.should.to.be.equal(execpted, 'double');

    });

    it('应该可以转换boolean类型', () => {
      const imports = new Array<string>();
      const input: SwaggerProperty = {
        type: "boolean"
      } as any;
      const expected = 'boolean';
      const result = translator.toPropertyType(input, imports, []);
      result.should.to.be.equal(expected);
    });

    it('应该可以转换string类型', () => {
      const imports = new Array<string>();
      const input: SwaggerProperty = {
        type: "string"
      } as any;
      const expected = 'string';
      const result = translator.toPropertyType(input, imports, []);
      result.should.to.be.equal(expected);
    });

    it('应该可以转换引用类型', () => {
      const imports = new Array<string>();
      const input: SwaggerProperty = {
        $ref: "#/definitions/Notice"
      } as any;

      const expected = `${translator.interfacePrefix}Notice`;

      const importStr = `import { ApiNotice } from './api/api-notice.ts'`;
      const stubToImport = stub(translator, 'toImport').withArgs('Notice').returns([
        importStr
      ]);
      const result = translator.toPropertyType(input, imports, []);

      result.should.to.be.equal(expected);
      stubToImport.should.to.have.calledOnce;
      imports.should.to.deep.equal([
        importStr
      ]);
    });

    it('应该可以转换引用泛型类型', () => {
      const imports = new Array<string>();
      const input: SwaggerProperty = {
        $ref: "#/definitions/Page«ActivityRecord»"
      } as any;

      const expected = `ApiPage<ApiActivityRecord>`;
      const expectedImports = [
        'import { ApiPage } from "./api/api-page.ts"',
        'import { ApiActivityRecord } from "./api/api-activityRecord.ts"'
      ];

      const stubToImport = stub(translator, 'toImport')
        .withArgs('Page«ActivityRecord»')
        .returns(expectedImports);

      const result = translator.toPropertyType(input, imports, []);

      result.should.to.be.equal(expected);
      stubToImport.should.to.have.calledOnce;
      imports.should.to.deep.equal(expectedImports);
    });

    it('应该可以转换Class引用泛型类型', () => {
      const imports = new Array<string>();
      const input: SwaggerProperty = {
        $ref: "#/definitions/Page«ActivityRecord»"
      } as any;

      const expected = `T0`;

      const stubToImport = stub(translator, 'toImport');

      const result = translator.toPropertyType(input, imports, [
        ['Page', ['ActivityRecord']]
      ]);

      result.should.to.be.equal(expected);
      stubToImport.should.to.not.have.called;
      imports.should.to.deep.equal([]);
    });

  });
});
