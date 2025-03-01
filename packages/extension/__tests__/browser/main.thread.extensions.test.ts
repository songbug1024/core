import * as ideCoreCommon from '@opensumi/ide-core-common';
import { Injectable, Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { OutputPreferences } from '@opensumi/ide-output/lib/browser/output-preference';
import * as types from '../../src/common/vscode/ext-types';
import { createExtensionsApiFactory } from '../../src/hosted/api/vscode/ext.host.extensions';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import ExtensionHostServiceImpl from '../../src/hosted/ext.host';
import { ExtensionNodeServiceServerPath } from '../../src/common';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../src/common/vscode';
import { MainThreadStorage } from '../../src/browser/vscode/api/main.thread.storage';
import { MainThreadExtensionLogIdentifier } from '../../src/common/extension-log';
import { MainThreadExtensionLog } from '../../src/browser/vscode/api/main.thread.log';
import { IExtensionStorageService } from '@opensumi/ide-extension-storage';
import { IContextKeyService, AppConfig } from '@opensumi/ide-core-browser';
import { AppConfig as NodeAppConfig } from '@opensumi/ide-core-node';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { IGlobalStorageServer } from '@opensumi/ide-storage';
import { MainThreadWebview } from '../../src/browser/vscode/api/main.thread.api.webview';

import { MockExtNodeClientService } from '../../__mocks__/extension.service.client';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { MockWorkbenchEditorService } from '../../../editor/src/common/mocks/workbench-editor.service';
import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import { FileSearchServicePath } from '@opensumi/ide-file-search';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceService } from '@opensumi/ide-workspace/lib/browser/workspace-service';
import { IThemeService, IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { WorkspacePreferences } from '@opensumi/ide-workspace/lib/browser/workspace-preferences';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { IWebviewService } from '@opensumi/ide-webview';
import { mockKaitianExtensionProviders } from './extension-service/extension-service-mock-helper';
import { MainThreadExtensionService } from '../../__mocks__/api/mainthread.extension.service';
import { IReporter, DefaultReporter } from '@opensumi/ide-core-common';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => ({
    log() {},
    debug() {},
    error() {},
    verbose() {},
    warn() {},
  });
}

@Injectable()
class MockStaticResourceService {
  resolveStaticResource(uri: ideCoreCommon.URI) {
    return uri.withScheme('file');
  }
  resourceRoots: [] = [];
}

const emitterA = new ideCoreCommon.Emitter<any>();
const emitterB = new ideCoreCommon.Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);

const rpcProtocolMain = new RPCProtocol(mockClientB);

describe('MainThreadExtensions Test Suites', () => {
  const extHostInjector = new Injector();
  extHostInjector.addProviders(
    {
      token: NodeAppConfig,
      useValue: {},
    },
    {
      token: IReporter,
      useClass: DefaultReporter,
    },
  );
  const injector = createBrowserInjector(
    [],
    new MockInjector([
      ...mockKaitianExtensionProviders,
      {
        token: OutputPreferences,
        useValue: {
          'output.logWhenNoPanel': true,
        },
      },
      {
        token: AppConfig,
        useValue: {
          noExtHost: false,
        },
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkbenchEditorService,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: ExtensionNodeServiceServerPath,
        useClass: MockExtNodeClientService,
      },
      {
        token: IExtensionStorageService,
        useValue: {
          whenReady: Promise.resolve(true),
          extensionStoragePath: {},
          set() {},
          get() {},
          getAll() {},
          reConnectInit() {},
        },
      },
      {
        token: IWorkspaceService,
        useClass: WorkspaceService,
      },
      {
        token: FileSearchServicePath,
        useValue: {
          find: () => Promise.resolve([]),
        },
      },
      {
        token: ideCoreCommon.StorageProvider,
        useValue: MockedStorageProvider,
      },
      {
        token: StaticResourceService,
        useClass: MockStaticResourceService,
      },
      {
        token: IThemeService,
        useValue: {
          applyTheme: () => {},
        },
      },
      {
        token: IGlobalStorageServer,
        useValue: {
          getItems() {
            return JSON.stringify({ language: 'zh_CN' });
          },
          init() {
            return Promise.resolve();
          },
          get() {
            return '';
          },
        },
      },
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: ideCoreCommon.ILoggerManagerClient,
        useClass: MockLoggerManagerClient,
      },
      {
        token: ideCoreCommon.IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: WorkspacePreferences,
        useValue: {
          onPreferenceChanged: () => {},
        },
      },
      {
        token: IWebviewService,
        useValue: mockService({}),
      },
    ]),
  );
  let extHostExtension: ReturnType<typeof createExtensionsApiFactory>;
  let mainthreadService: MainThreadExtensionService;
  let extensionHostService: ExtensionHostServiceImpl;
  const disposables: types.OutputChannel[] = [];

  afterAll(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  });

  beforeAll(async (done) => {
    injector.get(WorkbenchEditorService);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocolMain]));
    extensionHostService = new ExtensionHostServiceImpl(
      rpcProtocolExt,
      new MockLoggerManagerClient().getLogger(),
      extHostInjector,
    );
    mainthreadService = new MainThreadExtensionService();
    rpcProtocolMain.set(MainThreadExtensionLogIdentifier, injector.get(MainThreadExtensionLog, []));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadStorage, injector.get(MainThreadStorage, [rpcProtocolMain]));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadExtensionService, mainthreadService);
    rpcProtocolMain.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionHostService);
    // await mainthreadService.activate();
    await extensionHostService.init();
    await extensionHostService.$updateExtHostData();
    extHostExtension = createExtensionsApiFactory(extensionHostService);
    done();
  });

  it('should get all extension by extHostExtensionApi', (done) => {
    expect(extHostExtension.all.length).toBe(2);
    done();
  });

  it('should get a extension by extHostExtensionApi', async (done) => {
    const extension = extHostExtension.getExtension('test.sumi-extension');
    expect(extension).toBeDefined();
    expect(extension?.isActive).toBeFalsy();
    done();
  });

  it('should receive onDidChangeEvent when extension has changed', async (done) => {
    extHostExtension.onDidChange(() => {
      done();
    });

    extensionHostService.$fireChangeEvent();
  });
});
