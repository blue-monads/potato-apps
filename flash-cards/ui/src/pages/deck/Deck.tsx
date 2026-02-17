import React, { useEffect } from 'react';
import {useState} from 'react'
import { Plus, Folder, MoreVertical, Play, BookOpen, Book } from 'lucide-react';
import { useModal } from '../../lib/shared/modal/modal';
import { CreateDeckForm } from '../components/CreateDeckForm';
import { DynamicIcon } from '../components/DynamicIcon';
import { EditDeckForm } from '../components/EditDeckForm';
import { useNavigate } from 'react-router';
import { BASE_PATH } from '../../lib/base';
import { listDecks } from '../../lib/api';


const DecksPage = () => {
  const { openModal, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('')
  const [deckData, setDeckData] = useState<any>(null)
  const navigate = useNavigate();


  // Dummy data to visualize the UI
  const dummyDecks = [
    { id: 1, name: 'French Basics', cardCount: 12, icon: 'languages' },
    { id: 2, name: 'Travel Phrases', cardCount: 45, icon: 'globe' },
    { id: 3, name: 'Medical Terminology', cardCount: 120, icon: 'heart' },
  ];

  useEffect(()=>{
    loadDecks()
  },[]);

  const loadDecks = async () => {
    setLoading(true)
    const response = await listDecks(); 
    if (response.error){
        setError(response.error)
        console.log(`Failed to load deck - error message:${response.error}`)
    } else {
      console.log('-----------200 response ', response?.data)
       setDeckData(response?.data)
    }
  } 



  const handleCreateDeck = () => {
    openModal({
      title: 'Create New Deck',
      maxWidth: '400px',
      content: (
        <CreateDeckForm
          onSave={(name) => {
            console.log("Saving deck:", name);
            // Later we will call the API here
            closeModal();
          }}
        />
      )
    });
  };

  const handleEditDeck = ( id: number, name: string, icon: string ) => {
  openModal({
    title: 'Edit Deck',
    maxWidth: '400px',
    content: (
      <EditDeckForm 
        initialName={name}
        initialIcon={icon}
        onSave={(newName, newIcon) => {
          console.log(`Updating deck ${id}:`, newName, newIcon);
          // TODO: Call your update API
          closeModal();
        }} 
        onDelete={() => {
          console.log(`Deleting deck ${id}`);
          // TODO: Call your delete API
          closeModal();
        }}
      />
    )
  });
};




  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Decks</h1>
          <p className="text-gray-500 text-sm">Select a deck to start practicing</p>
        </div>
        <button
          onClick={handleCreateDeck}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer"
        >
          <Plus size={20} />
          Create Deck
        </button>
      </div>

      {/* Grid of Decks */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dummyDecks.map((deck) => (
          <div
            key={deck.id}
            className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                <DynamicIcon name={deck.icon}/>
              </div>
              {/* <button className="text-gray-400 hover:text-gray-600 p-1">
                <MoreVertical size={18} />
              </button> */}
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-1">{deck.name}</h3>
            <p className="text-gray-500 text-sm mb-6">{deck.cardCount} cards</p>

            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`${BASE_PATH}deck/${deck.id}`)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-sm font-semibold">
                <Play size={16} fill="currentColor" />
                Study
              </button>
              <button 
                onClick={()=>handleEditDeck(deck.id, deck.name, deck.icon)}
                className="cursor-pointer flex-1 flex items-center justify-center gap-2 bg-gray-50 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold">
                <BookOpen size={16} />
                Edit
              </button>
            </div>
          </div>
        ))}

        {/* Empty State / Add New Placeholder */}
        <div
          onClick={handleCreateDeck}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors cursor-pointer group">
          <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Plus size={24} />
          </div>
          <span className="font-medium" >Add New Deck</span>
        </div>
      </div>
    </div>
  );
};

export default DecksPage;


