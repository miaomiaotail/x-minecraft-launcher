import { ServiceKey } from './Service'

/**
 * Provide the abilities to diagnose & link resource packs files to instance
 */
export interface InstanceResourcePacksService {
  /**
   * Link the `resourcepacks` directory under the instance path to the root `resourcepacks` directory.
   * @param instancePath The instance path to link
   */
  link(instancePath: string): Promise<void>

  /**
   * Show the `resourcepacks` directory under the instance path
   * @param instancePath The instance path
   */
  showDirectory(instancePath: string): Promise<void>
}

export const InstanceResourcePacksServiceKey: ServiceKey<InstanceResourcePacksService> = 'InstanceResourcePacksService'
