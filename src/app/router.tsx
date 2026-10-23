import { createBrowserRouter } from 'react-router'
import { Home } from './Home'
import { Layout } from './Layout'
import { NotFound } from './NotFound'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
