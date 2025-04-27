import ssh2 from 'ssh2'
import { ListenOptions } from 'net'
import { sftpClient } from './sftp.js'
import { forwardOutStreamLocal } from './forward-out.js'
import { execCommand } from './exec.js'
import { Logger } from '../../log.js'

export { FileToCopy } from './files.js'

export const connectSshClient = async (
  { log, debug, ...connectConfig }: Omit<ssh2.ConnectConfig, 'debug'> & { log: Logger; debug: boolean },
) => {
  const ssh = new ssh2.Client()

  await new Promise<void>((resolve, reject) => {
    ssh.on('ready', resolve)
    ssh.on('error', reject)
    ssh.connect({
      algorithms: {
        ...connectConfig.algorithms,
        compress: connectConfig.algorithms?.compress ?? ['zlib@openssh.com', 'zlib', 'none'],
      },
      // Add keepalive options to prevent SSH timeouts during long builds
      keepaliveInterval: 60000, // 60 seconds
      keepaliveCountMax: 10, 
      ...connectConfig,
      debug: debug ? log.debug : undefined,
    })
  })

  const exec = execCommand(ssh)
  const sftp = sftpClient(ssh)

  const self = {
    sftp,
    exec,
    forwardOutStreamLocal: (
      listenAddress: string | number | ListenOptions,
      remoteSocket: string,
    ) => forwardOutStreamLocal({ ssh, log, listenAddress, remoteSocket }),
    [Symbol.dispose]: () => { ssh.end() },
  }

  return self
}

export type SshClient = Awaited<ReturnType<typeof connectSshClient>>
