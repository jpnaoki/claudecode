import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import StyleGuide from './pages/StyleGuide'
import Table from './pages/Table'
import Lobby from './pages/Lobby'

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/sala/:code', element: <Lobby /> },
  { path: '/mesa', element: <Table /> },
  { path: '/estilo', element: <StyleGuide /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
