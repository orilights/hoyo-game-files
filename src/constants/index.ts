import type { GameConfig } from '@/types'

export const GameConfigList: Record<string, GameConfig>
 = {
   hk4e: {
     name: '原神',
     icon: '/icon/hk4e.png',
     voice: ['汉语', '英语', '日语', '韩语'],
   },
   hkrpg: {
     name: '崩坏：星穹铁道',
     icon: '/icon/hkrpg.png',
     voice: [],
   },
   nap: {
     name: '绝区零',
     icon: '/icon/nap.png',
     voice: [],
   },
 }

export const VoicePackList: Record<string, string> = {
  汉语: 'Audio_Chinese_pkg_version',
  英语: 'Audio_English(US)_pkg_version',
  日语: 'Audio_Japanese_pkg_version',
  韩语: 'Audio_Korean_pkg_version',
}
