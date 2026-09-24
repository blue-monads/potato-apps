import { useParams, Link } from 'react-router'
import { useEffect, useState } from 'react'
import { BASE_PATH } from '../lib/base'
import { authorsApi } from '../lib/api'

type Author = {
  name: string
  quotes: string[]
}

function Author() {
  const { author: authorSlug } = useParams<{ author: string }>()
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

  const authorData = authors[authorSlug || ''] || null

  if (loading) {
    return (
      <div className="min-h-screen w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Loading...</h1>
        <Link to={BASE_PATH} className="text-blue-600 hover:underline">Back to Authors</Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Error</h1>
        <p className="text-red-600">{error}</p>
        <Link to={BASE_PATH} className="text-blue-600 hover:underline">Back to Authors</Link>
      </div>
    )
  }

  if (!authorData) {
    return (
      <div className="min-h-screen w-full p-8">
        <h1 className="text-2xl font-bold mb-6">Author not found</h1>
        <Link to={BASE_PATH} className="text-blue-600 hover:underline">Back to Authors</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full p-8">
      <Link to={BASE_PATH} className="text-blue-600 hover:underline mb-6 inline-block">← Back to Authors</Link>
      <h1 className="text-2xl font-bold mb-6">{authorData.name}</h1>
      <div className="space-y-4">
        {authorData.quotes.map((quote, index) => (
          <blockquote
            key={index}
            className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 italic"
          >
            "{quote}"
          </blockquote>
        ))}
      </div>
    </div>
  )
}

export default Author
