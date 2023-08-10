import { AUTHORITY_DEV } from '../util/authority'
import { Exception } from '../entities/exception'
import { UserProfile } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'
import { UserExceptions } from './UserService'

interface LaunchServiceEventMap {
  'minecraft-window-ready': { pid?: number }
  'minecraft-start': {
    pid?: number
    version: string
    minecraft: string
    forge: string
    fabricLoader: string
  }
  'minecraft-exit': { pid?: number; code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }
  'minecraft-stdout': { pid?: number; stdout: string }
  'minecraft-stderr': { pid?: number; stdout: string }
  'error': LaunchException
}

export interface LaunchOptions {
  /**
   * Override selected version for current instance
   */
  version: string
  /**
   * The game directory of the minecraft
   */
  gameDirectory: string
  /**
   * The user to launch
   */
  user: UserProfile
  /**
   * The java exe path
   */
  java: string
  /**
   * Override the launch to server options
   */
  server?: {
    host: string
    port?: number
  }
  /**
   * Support yushi's yggdrasil agent https://github.com/to2mbn/authlib-injector/wiki
   */
  yggdrasilAgent?: {
    /**
     * The jar file path of the authlib-injector
     */
    jar: string
    /**
     * The auth server url.
     *
     * If this input is {@link AUTHORITY_DEV}. This will be resolved to the localhost yggrasil server
     */
    server: string
    /**
     * The prefetched base64
     */
    prefetched?: string
  }
  /**
   * Hide launcher after game started
   */
  hideLauncher?: boolean
  /**
   * Show log window after game started
   */
  showLog?: boolean
  /**
   * The launcher name
   */
  launcherName?: string
  /**
   * The launcher brand
   */
  launcherBrand?: string
  /**
   * The maximum memory to allocate
   */
  maxMemory?: number
  /**
   * The minimum memory to allocate
   */
  minMemory?: number
  /**
   * Skip assets check before launch
   */
  skipAssetsCheck?: boolean
  /**
   * The extra arguments for java vm
   */
  vmOptions?: string[]
  /**
   * The extra arguments for minecraft
   */
  mcOptions?: string[]
}

export interface LaunchService extends GenericEventEmitter<LaunchServiceEventMap> {
  /**
   * Generate useable launch arguments for current profile
   */
  generateArguments(options: LaunchOptions): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indicate whether launch is success.
   * @returns Does this launch request success?
   */
  launch(options: LaunchOptions): Promise<boolean>
}

export type LaunchExceptions = {
  type: 'launchNoVersionInstalled'
  /**
   * The override version in options
   */
  override?: string
  /**
   * The version in instance
   */
  version?: string
  minecraft: string
  forge?: string
  fabric?: string
} | {
  /**
   * Unknown error
   */
  type: 'launchGeneralException'
  error: unknown
} | {
  /**
   * Unknown java error. Might be empty java path
   */
  type: 'launchNoProperJava'
  javaPath: string
} | {
  /**
   * Java path is invalid
   */
  type: 'launchInvalidJavaPath'
  javaPath: string
} | {
  /**
   * No permission to use that java
   */
  type: 'launchJavaNoPermission'
  javaPath: string
} | {
  /**
   * Refresh user status failed
   */
  type: 'launchUserStatusRefreshFailed'
  userException: UserExceptions
}

export class LaunchException extends Exception<LaunchExceptions> { }

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
