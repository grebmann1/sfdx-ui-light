const { app,Menu }   = require('electron');

const template = [
    // { role: 'appMenu' }
    ...[{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }],
    // { role: 'editMenu' }
    {
      label: 'Settings',
      submenu: [
        {
            label: 'Enable Multi Windows',
            type: 'checkbox', checked: true,
            click: async () => {
                console.log('Menu checked');
                //const { shell } = require('electron')
                //await shell.openExternal('https://electronjs.org')
            }
        }
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)