import { MutableState } from '../util/MutableState'
import { InstanceManifest } from '../entities/instanceManifest.schema'
import { GenericEventEmitter } from '../events'
import { ConnectionState, ConnectionUserInfo, IceGatheringState, Peer, SelectedCandidateInfo, SignalingState, TransferDescription } from '../multiplayer'
import { ServiceKey } from './Service'

export class PeerState {
  connections = [] as Peer[]
  validIceServers = [] as string[]
  ips = [] as string[]

  connectionUserInfo({ id, info }: { id: string; info: ConnectionUserInfo }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.userInfo = info
    }
  }

  connectionShareManifest({ id, manifest }: { id: string; manifest?: InstanceManifest }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.sharing = manifest
    }
  }

  connectionRemoteSet({ id, remoteId }: { id: string; remoteId: string }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.remoteId = remoteId
    }
  }

  connectionAdd(connection: Peer) {
    if (this.connections.find(c => c.id === connection.id)) {
      return
    }
    this.connections.push(connection)
  }

  connectionDrop(connectionId: string) {
    this.connections = this.connections.filter(c => c.id !== connectionId)
  }

  connectionIceServerSet({ id, iceServer }: { id: string; iceServer: string }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      if (conn.iceServer) {
        conn.triedIceServers.push(conn.iceServer)
      }
      conn.iceServer = iceServer
    }
  }

  connectionLocalDescription(update: { id: string; description: string }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.localDescriptionSDP = update.description
    }
  }

  connectionStateChange(update: { id: string; connectionState: ConnectionState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.connectionState = update.connectionState
    }
  }

  connectionSelectedCandidate({ id, local, remote }: {
    id: string
    local: SelectedCandidateInfo
    remote: SelectedCandidateInfo
  }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.selectedCandidate = {
        local,
        remote,
      }
    }
  }

  connectionPing(update: { id: string; ping: number }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.ping = update.ping
    }
  }

  connectionPreferredIceServers({ id, servers }: { id: string; servers: string[] }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.preferredIceServers = servers
    }
  }

  iceGatheringStateChange(update: { id: string; iceGatheringState: IceGatheringState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.iceGatheringState = update.iceGatheringState
    }
  }

  signalingStateChange(update: { id: string; signalingState: SignalingState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.signalingState = update.signalingState
    }
  }

  connectionIceServersSet({ id, iceServer }: { id: string; iceServer: string }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.iceServer = iceServer
      conn.triedIceServers = [...conn.triedIceServers, conn.iceServer]
    }
  }

  validIceServerSet(servers: string[]) {
    this.validIceServers = servers
  }

  ipsSet(ips: string[]) {
    this.ips = ips
  }
}

export interface ShareInstanceOptions {
  instancePath: string
  manifest?: InstanceManifest
}

interface PeerServiceEvents {
  share: { id: string; manifest?: InstanceManifest }
}

export interface PeerService extends GenericEventEmitter<PeerServiceEvents> {
  getPeerState(): Promise<MutableState<PeerState>>
  /**
    * Share the instance to other peers
    */
  shareInstance(options: ShareInstanceOptions): Promise<void>
}

export const PeerServiceKey: ServiceKey<PeerService> = 'PeerServiceKey'
