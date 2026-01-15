import { Inbox, FileText } from 'lucide-react';

const Submissions = () => {
    return (
        <div className="flex flex-col min-h-screen">
            <div className="bg-white border-b border-gray-200 py-4 px-6 flex shadow-sm items-center">
                <div className="flex items-center gap-3">
                    <Inbox className="w-6 h-6 text-gray-600" />
                    <h1 className="text-2xl font-bold text-gray-800">Submissions</h1>
                </div>
            </div>

            <main className="flex-1 overflow-auto p-6 bg-gray-50">
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <FileText className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg mb-2">No submissions yet</p>
                    <p className="text-sm">Form submissions will appear here</p>
                </div>
            </main>
        </div>
    )
}

export default Submissions;