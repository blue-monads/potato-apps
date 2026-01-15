import { useParams, Link } from 'react-router'
import FormBuilder from './sub/FormBuilder'
import { ArrowLeftIcon } from 'lucide-react'
import { basePath } from '../../lib/base'

const FormBuilderPage = () => {
  const { formId } = useParams<{ formId: string }>()
  const formIdNum = formId ? parseInt(formId, 10) : undefined

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 shadow-sm">
        <Link
          to={`${basePath}forms`}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Back to Forms</span>
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <FormBuilder formId={formIdNum} />
      </div>
    </div>
  )
}

export default FormBuilderPage

