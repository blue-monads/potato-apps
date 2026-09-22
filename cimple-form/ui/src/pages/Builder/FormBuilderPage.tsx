import { useParams, useSearchParams } from 'react-router';
import FormBuilder from './sub/FormBuilder';

const FormBuilderPage = () => {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'responses' || tabParam === 'preview' ? tabParam : 'build';
  const formIdNum = formId ? parseInt(formId, 10) : undefined;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <FormBuilder formId={formIdNum} initialTab={initialTab} />
    </div>
  );
};

export default FormBuilderPage;

