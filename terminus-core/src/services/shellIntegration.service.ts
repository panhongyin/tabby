import * as path from 'path'
import * as fs from 'mz/fs'
import { exec } from 'mz/child_process'
import { Injectable } from '@angular/core'
import { ElectronService } from './electron.service'
import { HostAppService, Platform } from './hostApp.service'

try {
    var wnr = require('windows-native-registry') // tslint:disable-line
} catch (_) { } // tslint:disable-line

@Injectable({ providedIn: 'root' })
export class ShellIntegrationService {
    private automatorWorkflows = ['Open Terminus here.workflow', 'Paste path into Terminus.workflow']
    private automatorWorkflowsLocation: string
    private automatorWorkflowsDestination: string
    private registryKeys = [
        {
            path: 'Software\\Classes\\Directory\\Background\\shell\\Open Terminus here',
            command: 'open "%V"'
        },
        {
            path: 'Software\\Classes\\*\\shell\\Paste path into Terminus',
            command: 'paste "%V"'
        },
    ]
    constructor (
        private electron: ElectronService,
        private hostApp: HostAppService,
    ) {
        if (this.hostApp.platform === Platform.macOS) {
            this.automatorWorkflowsLocation = path.join(
                path.dirname(path.dirname(this.electron.app.getPath('exe'))),
                'Resources',
                'extras',
                'automator-workflows',
            )
            this.automatorWorkflowsDestination = path.join(process.env.HOME, 'Library', 'Services')
        }
        this.updatePaths()
    }

    private async updatePaths (): Promise<void> {
        // Update paths in case of an update
        if (this.hostApp.platform === Platform.Windows) {
            if (await this.isInstalled()) {
                await this.install()
            }
        }
    }

    async isInstalled (): Promise<boolean> {
        if (this.hostApp.platform === Platform.macOS) {
            return fs.exists(path.join(this.automatorWorkflowsDestination, this.automatorWorkflows[0]))
        } else if (this.hostApp.platform === Platform.Windows) {
            return !!wnr.getRegistryKey(wnr.HK.CU, this.registryKeys[0].path)
        }
        return true
    }

    async install () {
        if (this.hostApp.platform === Platform.macOS) {
            for (let wf of this.automatorWorkflows) {
                await exec(`cp -r "${this.automatorWorkflowsLocation}/${wf}" "${this.automatorWorkflowsDestination}"`)
            }
        } else if (this.hostApp.platform === Platform.Windows) {
            for (let registryKey of this.registryKeys) {
                wnr.createRegistryKey(wnr.HK.CU, registryKey.path)
                wnr.createRegistryKey(wnr.HK.CU, registryKey.path + '\\command')
                wnr.setRegistryValue(wnr.HK.CU, registryKey.path, 'Icon', wnr.REG.SZ, this.electron.app.getPath('exe'))
                wnr.setRegistryValue(wnr.HK.CU, registryKey.path + '\\command', '', wnr.REG.SZ, this.electron.app.getPath('exe') + ' ' + registryKey.command)
            }
        }
    }

    async remove () {
        if (this.hostApp.platform === Platform.macOS) {
            for (let wf of this.automatorWorkflows) {
                await exec(`rm -rf "${this.automatorWorkflowsDestination}/${wf}"`)
            }
        } else if (this.hostApp.platform === Platform.Windows) {
            for (let registryKey of this.registryKeys) {
                wnr.deleteRegistryKey(wnr.HK.CU, registryKey.path)
            }
        }
    }
}
