import { Link } from 'react-router';
import { basePath } from '../../lib/base';

const Submissions = () => {
    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg)]">
            <header className="bg-white border-b border-[#E1E3DB] py-3.5 px-8 flex shadow-sm items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        to={`${basePath}forms`}
                        className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-[#FAFAF7] hover:bg-[#EEF0EA] border border-[#E1E3DB] px-2.5 py-1.5 rounded-md transition-colors"
                    >
                        <i className="fa-solid fa-arrow-left text-xs"></i>
                        <span>Forms</span>
                    </Link>
                    <span className="text-gray-300 font-light select-none">/</span>
                    <h1 className="text-lg font-bold font-heading text-gray-900 tracking-tight">Submissions</h1>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
                <div className="bg-white border border-[#E1E3DB] rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-[#EEF0EA] flex items-center justify-center text-gray-400 text-2xl mb-2">
                        <i className="fa-solid fa-inbox"></i>
                    </div>
                    <h3 className="font-heading font-bold text-lg text-gray-900">No submissions yet</h3>
                    <p className="text-xs text-gray-500 max-w-sm">
                        Submissions sent through your published forms and preview testing will be summarized here.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Submissions;