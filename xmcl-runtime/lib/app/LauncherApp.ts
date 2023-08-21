import { getPlatform } from '@xmcl/core'
import { AppManifest, InstalledAppManifest, Platform } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { ensureDir } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import { Server, createServer } from 'http'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { setTimeout } from 'timers/promises'
import { URL } from 'url'
import { IS_DEV, LAUNCHER_NAME } from '../constant'
import { Manager } from '../managers'
import SemaphoreManager from '../managers/SemaphoreManager'
import ServiceStateManager from '../managers/ServiceStateManager'
import TaskManager from '../managers/TaskManager'
import { plugins } from '../plugins'
import { ServiceConstructor } from '../services/Service'
import { isSystemError } from '../util/error'
import { Logger } from '../util/log'
import { ObjectFactory } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { listen } from '../util/server'
import { Host } from './Host'
import { LauncherAppController } from './LauncherAppController'
import { LauncherAppManager } from './LauncherAppManager'
import { LauncherAppUpdater } from './LauncherAppUpdater'
import { LauncherProtocolHandler } from './LauncherProtocolHandler'
import { SecretStorage } from './SecretStorage'
import { Shell } from './Shell'
import { LauncherAppKey } from './utils'

export interface LauncherAppPlugin {
  (app: LauncherApp, manifest: AppManifest, services: ServiceConstructor[]): void
}

export interface LauncherApp {
  on(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  on(channel: 'window-all-closed', listener: () => void): this
  on(channel: 'engine-ready', listener: () => void): this
  on(channel: 'root-migrated', listener: (newRoot: string) => void): this

  once(channel: 'app-booted', listener: (manifest: InstalledAppManifest) => void): this
  once(channel: 'window-all-closed', listener: () => void): this
  once(channel: 'engine-ready', listener: () => void): this
  once(channel: 'root-migrated', listener: (newRoot: string) => void): this

  emit(channel: 'app-booted', manifest: InstalledAppManifest): this
  emit(channel: 'window-all-closed'): boolean
  emit(channel: 'engine-ready'): boolean
  emit(channel: 'root-migrated', root: string): this
}

export interface LogEmitter extends EventEmitter {
  on(channel: 'info', listener: (destination: string, tag: string, message: string, ...options: any[]) => void): this
  on(channel: 'warn', listener: (destination: string, tag: string, message: string, ...options: any[]) => void): this
  on(channel: 'failure', listener: (destination: string, tag: string, error: Error) => void): this

  emit(channel: 'info', destination: string, tag: string, message: string, ...options: any[]): boolean
  emit(channel: 'warn', destination: string, tag: string, message: string, ...options: any[]): boolean
  emit(channel: 'failure', destination: string, tag: string, error: Error): boolean
}

export class LauncherApp extends EventEmitter {
  /**
   * Launcher %APPDATA%/xmcl path
   */
  readonly appDataPath: string

  /**
   * The .minecraft folder in Windows or minecraft folder in linux/mac
   */
  readonly minecraftDataPath: string

  /**
   * Path to temporary folder
   */
  readonly temporaryPath: string

  readonly serviceStateManager: ServiceStateManager
  readonly taskManager: TaskManager
  readonly semaphoreManager: SemaphoreManager
  readonly launcherAppManager: LauncherAppManager
  readonly logEmitter: LogEmitter = new EventEmitter()

  readonly platform: Platform

  readonly build: number = Number.parseInt(process.env.BUILD_NUMBER ?? '0', 10)

  readonly env: 'raw' | 'appx' | 'appimage' = process.env.RUNTIME as any || 'raw'

  get version() { return this.host.getVersion() }

  protected managers: Manager[]

  readonly protocol = new LauncherProtocolHandler()

  readonly server: Server = createServer((req, res) => {
    this.protocol.handle({
      method: req.method,
      url: new URL(req.url ?? '/', 'xmcl://launcher'),
      headers: req.headers,
      body: req,
    }).then((resp) => {
      res.statusCode = resp.status
      for (const [k, v] of Object.entries(resp.headers)) {
        res.setHeader(k, v)
      }
      if (resp.body instanceof Readable) {
        pipeline(resp.body, res)
      } else {
        res.end(resp.body)
      }
    }, (e) => {
      res.statusCode = 500
      res.end()
    })
  })

  /**
   * The controller is response to keep the communication between main process and renderer process
   */
  readonly controller: LauncherAppController
  /**
   * The updater of the launcher
   */
  readonly updater: LauncherAppUpdater

  readonly registry: ObjectFactory = new ObjectFactory()
  private initialInstance = ''
  private preferredLocale = ''
  private gamePathSignal = createPromiseSignal<string>()
  private gamePathMissingSignal = createPromiseSignal<boolean>()
  protected logger: Logger = this.getLogger('App')

  readonly localhostServerPort: Promise<number>

  constructor(
    readonly host: Host,
    readonly shell: Shell,
    readonly secretStorage: SecretStorage,
    getController: (app: LauncherApp) => LauncherAppController,
    getUpdater: (app: LauncherApp) => LauncherAppUpdater,
    readonly builtinAppManifest: InstalledAppManifest,
    services: ServiceConstructor[],
    _plugins: LauncherAppPlugin[],
  ) {
    super()
    this.temporaryPath = ''
    const appData = host.getPath('appData')

    const plat = getPlatform()
    this.platform = {
      os: plat.name,
      osRelease: plat.version,
      arch: plat.arch,
    }
    this.appDataPath = join(appData, LAUNCHER_NAME)
    this.minecraftDataPath = join(appData, this.platform.os === 'osx' ? 'minecraft' : '.minecraft')

    this.registry.register(LauncherAppKey, this)
    this.controller = getController(this)
    this.updater = getUpdater(this)

    this.serviceStateManager = new ServiceStateManager(this)
    this.taskManager = new TaskManager(this)
    this.semaphoreManager = new SemaphoreManager(this)
    this.launcherAppManager = new LauncherAppManager(this)

    for (const plugin of plugins.concat(_plugins)) {
      plugin(this, builtinAppManifest, services)
    }

    this.managers = [this.taskManager, this.serviceStateManager, this.semaphoreManager, this.launcherAppManager]

    this.localhostServerPort = listen(this.server, 25555, (cur) => cur + 7)
  }

  getAppInstallerStartUpUrl(): string {
    return ''
  }

  getInitialInstance() {
    return this.initialInstance
  }

  getPreferredLocale() {
    return this.preferredLocale
  }

  getGameDataPath() {
    return this.gamePathSignal.promise
  }

  isGameDataPathMissing() {
    return this.gamePathMissingSignal.promise
  }

  getLogger(tag: string, destination = 'main'): Logger {
    return {
      log: (message: any, ...options: any[]) => {
        this.logEmitter.emit('info', destination, tag, message, ...options)
      },
      warn: (message: any, ...options: any[]) => {
        this.logEmitter.emit('warn', destination, tag, message, ...options)
      },
      error: (e: Error, scope?: string) => {
        this.logEmitter.emit('failure', destination, tag, e)
      },
    }
  }

  private disposers: (() => Promise<void>)[] = []
  registryDisposer(disposer: () => Promise<void>) {
    this.disposers.push(disposer)
  }

  /**
   * Quit the app gently.
   */
  async quit() {
    this.logger.log('Try to gently close the app')

    try {
      await Promise.race([
        setTimeout(10000).then(() => false),
        Promise.all(this.disposers.map(m => m())).then(() => true),
      ])
    } finally {
      this.host.quit()
    }
  }

  /**
   * Force exit the app with exit code
   */
  exit(code?: number): void {
    this.host.exit(code)
  }

  waitEngineReady(): Promise<void> {
    return this.host.whenReady()
  }

  relaunch(): void { this.host.relaunch() }

  // setup code

  async start(): Promise<void> {
    await Promise.all([
      this.setup(),
      this.waitEngineReady().then(() => {
        this.onEngineReady()
      })],
    )
  }

  /**
   * Determine the root of the project. By default, it's %APPDATA%/xmcl
   */
  protected async setup() {
    process.on('SIGINT', () => {
      this.host.quit()
    })

    // singleton lock
    if (!this.host.requestSingleInstanceLock()) {
      this.host.quit()
      return
    }

    this.logger.log(`Boot from ${this.appDataPath}`)

    // register xmcl protocol
    if (!this.host.isDefaultProtocolClient('xmcl')) {
      const result = this.host.setAsDefaultProtocolClient('xmcl')
      if (result) {
        this.logger.log('Successfully register the xmcl protocol')
      } else {
        this.logger.log('Fail to register the xmcl protocol')
      }
    }

    await ensureDir(this.appDataPath)

    let gameDataPath: string
    try {
      gameDataPath = await readFile(join(this.appDataPath, 'root')).then((b) => b.toString().trim())
      this.gamePathMissingSignal.resolve(false)
    } catch (e) {
      if (isSystemError(e) && e.code === 'ENOENT') {
        // first launch
        this.gamePathMissingSignal.resolve(true)
        const { path, instancePath, locale } = await this.controller.processFirstLaunch()
        this.initialInstance = instancePath
        this.preferredLocale = locale
        gameDataPath = (path)
        await writeFile(join(this.appDataPath, 'root'), path)
      } else {
        this.gamePathMissingSignal.resolve(false)
        gameDataPath = (this.appDataPath)
      }
    }

    try {
      await ensureDir(gameDataPath)
      this.gamePathSignal.resolve(gameDataPath)
    } catch {
      gameDataPath = this.appDataPath
      await ensureDir(gameDataPath)
      this.gamePathSignal.resolve(gameDataPath)
    }

    (this.temporaryPath as any) = join(gameDataPath, 'temp')
    await ensureDir(this.temporaryPath)
  }

  async migrateRoot(newRoot: string) {
    this.gamePathSignal = createPromiseSignal<string>()
    this.gamePathSignal.resolve(newRoot)
    await writeFile(join(this.appDataPath, 'root'), newRoot)
    this.emit('root-migrated', newRoot)
  }

  protected async getStartupUrl() {
    if (!IS_DEV && process.platform === 'win32') {
      this.logger.log(`Try to check the start up url: ${process.argv.join(' ')}`)
      if (process.argv.length > 1) {
        const urlOption = process.argv.find(a => a.startsWith('--url='))
        if (urlOption) {
          const url = urlOption.substring('--url='.length)
          if (url) {
            return url
          }
        }
        this.logger.log('Didn\'t find --url options')
        const protocolOption = process.argv.find(a => a.startsWith('xmcl://'))
        if (protocolOption) {
          const u = new URL(protocolOption)
          if (u.host === 'launcher' && u.pathname === '/app' && u.searchParams.has('url')) {
            return u.searchParams.get('url')
          }
        }
        this.logger.log('Didn\'t find xmcl:// protocol')
      }
    }
    this.logger.log('Didn\'t find the start up url, try to load from config file.')
    const { default: url } = JSON.parse(await readFile(join(this.launcherAppManager.root, 'apps.json'), 'utf-8'))

    return url
  }

  protected async onEngineReady() {
    this.logger.log(`cwd: ${process.cwd()}`)

    // start the app
    let app: InstalledAppManifest
    try {
      const url = await this.getStartupUrl()
      this.logger.log(`Try to use start up url ${url}`)
      const existedApp = await this.launcherAppManager.tryGetInstalledApp(url)
      if (existedApp) {
        app = existedApp
      } else {
        app = await this.launcherAppManager.installApp(url)
      }
    } catch (e) {
      this.logger.warn('Fail to use start up url:')
      this.logger.warn(e)
      try {
        const startUp = this.getAppInstallerStartUpUrl()
        if (startUp) {
          this.logger.log(`Try to use appinstaller startup url: "${startUp}"`)
          app = await this.launcherAppManager.installApp(startUp)
        } else {
          app = this.builtinAppManifest
        }
      } catch (e) {
        app = this.builtinAppManifest
      }
    }
    await this.controller.activate(app)
    this.logger.log(`Current launcher core version is ${this.version}.`)
    this.logger.log('App booted')

    await this.gamePathSignal.promise
    this.emit('engine-ready')
  }
}

export default LauncherApp
