import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import store from './store/store'
import socket from 'lib/socket'
import AppRouter from 'lib/AppRouter'
import { connectSocket } from './store/modules/user'
import { SOCKET_AUTH_ERROR } from 'shared/actionTypes'
import Persistor from 'store/Persistor'

Persistor.init(store, () => {
  // rehydration complete; open socket connection
  // if it looks like we have a valid session
  if (store.getState().user.userId !== null) {
    store.dispatch(connectSocket())
    socket.open()
  }
})

socket.on('reconnect_attempt', () => {
  store.dispatch(connectSocket())
})

// stop reconnecting when server rejects our session
// (e.g. room was deleted); user must re-login
socket.on('action', (action) => {
  if (action.type === SOCKET_AUTH_ERROR) {
    socket.close()
  }
})

// ========================================================
// Go!
// ========================================================
createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <RouterProvider router={AppRouter} />
    </React.StrictMode>,
  )
