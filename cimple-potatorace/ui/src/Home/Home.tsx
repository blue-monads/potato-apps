import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import { BASE_PATH } from '../lib/base'
import { authorsApi } from '../lib/api'

type Author = {
  name: string
  quotes: string[]
}

function Home() {
  const [authors, setAuthors] = useState<Record<string, Author>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authorsApi.list()
      .then(data => {
        setAuthors(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load authors:', err)
        setError('Failed to load authors')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Authors</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Authors</h1>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full p-8">
      <h1 className="text-2xl font-bold mb-6">Authors</h1>
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">Author</th>

            <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(authors).map(([slug, data]) => {
            return (
              <tr key={slug} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  <Link to={`${BASE_PATH}${slug}`} className="text-blue-600 hover:underline">
                    {data.name}
                  </Link>
                </td>

                <td className="border border-gray-300 px-4 py-2">
                  <Link to={`${BASE_PATH}${slug}`} className="text-blue-600 hover:underline">
                    View Quotes
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default Home
