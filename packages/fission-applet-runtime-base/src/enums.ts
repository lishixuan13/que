export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec',
  SERVER_PREFETCH = 'sp',
  // page
  PAGE_LOAD = 'pl',
  PAGE_SHOW = 'ps',
  PAGE_HIDE = 'ph',
  PAGE_READY = 'pr',
  PAGE_UNLOAD = 'pul',
  PAGE_TITLE_CLICK = 'ptc',
  PAGE_PULL_DOWN_REFRESH = 'ppdp',
  PAGE_REACH_BOTTOM = 'prb',
  PAGE_TAB_ITEM_TAP = 'ptit',
  PAGE_PAGE_SCROLL = 'pps',
  PAGE_SHARE_APP_MESSAGE = 'psam',
  // onShareAppMessage
  // app
  APP_LAUNCH = 'al',
  APP_SHOW = 'as',
  APP_HIDE = 'ah',
  APP_ERROR = 'ae',
  APP_PAGE_NOT_FOUND = 'apnf',
  APP_UNHANDLE_REJECTION = 'aur',
}

export const enum InstanceType {
  APP = 'app',
  PAGE = 'page',
  COMPONENT = 'component',
}
