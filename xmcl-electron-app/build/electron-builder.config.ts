import { Configuration } from 'electron-builder'
import { version } from '../package.json'

export const config: Configuration = {
  productName: 'xmcl',
  appId: 'xmcl',
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  // assign publish for auto-updater
  // set this to your own repo!
  publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],
  files: [
    'dist/**/*',
  ],
  asarUnpack: [
    '**/assets/**/*.cs',
    '**/assets/**/*.node',
    '**/assets/**/*.lib',
    '**/assets/**/*.so',
    '**/assets/**/*.dll',
    '**/*.worker.js',
  ],
  // eslint-disable-next-line no-template-curly-in-string
  artifactName: '${productName}-${version}-${platform}-${arch}.${ext}',
  appx: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}-unsigned.${ext}',
    displayName: 'X Minecraft Launcher',
    applicationId: 'CI010.XMCL',
    identityName: 'XMCL',
    backgroundColor: 'transparent',
    publisher: 'E=cijhn@hotmail.com, CN=&quot;Open Source Developer, Hongze Xu&quot;, O=Open Source Developer, L=Beijing, C=CN',
    publisherDisplayName: 'CI010',
    setBuildNumber: true,
    languages: ['en-US', 'zh-CN', 'ru'],
  },
  dmg: {
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}.${ext}',
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 130,
        y: 150,
        type: 'file',
      },
    ],
  },
  mac: {
    icon: 'build/icons/icon.icns',
    target: [
      {
        target: 'zip',
      },
      {
        target: 'dmg',
      },
    ],
  },
  win: {
    icon: 'build/icons/icon.ico',
    files: [
      '**/*.cs',
      '**/*.worker.js',
    ],
    target: [
      process.env.BUILD_TARGET === 'appx'
        ? 'appx'
        : {
          target: 'zip',
          arch: [
            'x64',
            'ia32',
          ],
        },
    ],
  },
  linux: {
    icon: 'build/icons',
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${productName}-${version}.${ext}',
    target: [
      {
        target: 'deb',
      },
      {
        target: 'rpm',
      },
      {
        target: 'AppImage',
      },
      {
        target: 'snap',
      },
    ],
  },
  snap: {
    publish: [
      'github',
    ],
  },
}
