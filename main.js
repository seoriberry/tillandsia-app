const { app, BrowserWindow, ipcMain, screen, Menu, MenuItem } = require('electron');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const diskusage = require('diskusage');

let win;
let lastData = null;

function createWindow() {
  win = new BrowserWindow({
    width: 220,
    height: 240,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  win.webContents.on('context-menu', () => {
    const menu = new Menu();
    menu.append(new MenuItem({
      label: '상태',
      enabled: false,
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: `열린 앱: ${lastData ? lastData.appCount + '개' : '..'}`,
      enabled: false,
    }));
    menu.append(new MenuItem({
      label: `재부팅: ${lastData ? lastData.uptime + '일 경과' : '..'}`,
      enabled: false,
    }));
    menu.append(new MenuItem({
      label: `저장공간: ${lastData ? lastData.diskFreePercent + '% 여유' : '..'}`,
      enabled: false,
    }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: '종료',
      click: () => app.quit(),
    }));
    menu.popup();
  });
}

ipcMain.on('move-window', (event, { x, y }) => {
  if(win) win.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle('get-cursor-pos', () => {
  return screen.getCursorScreenPoint();
});

ipcMain.handle('get-window-pos', () => {
  const pos = win.getPosition();
  return { x: pos[0], y: pos[1] };
});

function getAppCount() {
  try {
    const result = execSync(
      `osascript -e 'tell application "System Events" to count (every process whose background only is false)'`
    ).toString().trim();
    return parseInt(result);
  } catch(e) {
    return 5;
  }
}

async function getSystemData() {
  const appCount = getAppCount();
  const uptime = Math.floor(os.uptime() / 86400);

  let diskFreePercent = 100;
  try {
    const info = await diskusage.check('/');
    diskFreePercent = Math.round((info.free / info.total) * 100);
  } catch(e) {
    diskFreePercent = 100;
  }

  const isTired = uptime >= 5;

  let dustLevel;
  if(appCount <= 4) dustLevel = 0;
  else if(appCount <= 7) dustLevel = 1;
  else if(appCount <= 10) dustLevel = 2;
  else dustLevel = 3;

  let state;
  if(isTired && dustLevel >= 2) state = 'tired_dusty';
  else if(isTired) state = 'tired';
  else if(dustLevel === 0) state = 'clean';
  else if(dustLevel === 1) state = 'dust1';
  else if(dustLevel === 2) state = 'dust2';
  else state = 'dust3';

  lastData = { state, appCount, uptime, diskFreePercent };

  console.log('앱 수:', appCount, '업타임:', uptime, '디스크 여유:', diskFreePercent + '%', '상태:', state);

  return { state, appCount, uptime, diskFreePercent };
}

app.whenReady().then(() => {
  createWindow();

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
  });

  setTimeout(async () => {
    const data = await getSystemData();
    win.webContents.send('system-data', data);
  }, 2000);

  setInterval(async () => {
    if(win) {
      const data = await getSystemData();
      win.webContents.send('system-data', data);
    }
  }, 10000);
});

app.on('window-all-closed', () => {
  if(process.platform !== 'darwin') app.quit();
});