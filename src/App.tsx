import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Send, Search, Menu, Mail, Bell, Edit3, User, Award, Shield, MessageSquare, Image, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import logoImg from './assets/logo.png';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user_name: string;
  user_avatar: string;
  likes: { user_id: string }[];
  comments: any[];
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  sender_name: string;
  sender_id: string;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');

  // Éléments pour la gestion de l'image du post
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // États pour l'onglet Messagerie
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newLiveMessage, setNewLiveMessage] = useState('');

  // États Auth
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchPosts();
        fetchChatMessages();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchPosts();
        fetchChatMessages();
      } else {
        setPosts([]);
        setChatMessages([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchChatMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`id, content, image_url, created_at, profiles ( full_name, avatar_url ), likes ( user_id ), comments ( id, content, created_at, profiles ( full_name ) )`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setPosts(data.map((post: any) => ({
          id: post.id,
          content: post.content,
          image_url: post.image_url,
          created_at: new Date(post.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          user_name: post.profiles?.full_name || 'Membre KoZons',
          user_avatar: post.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          likes: post.likes || [],
          comments: post.comments || []
        })));
      }
    } catch (error) { console.error(error); }
  };

  const fetchChatMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`id, content, sender_id, created_at, profiles ( full_name )`)
        .order('created_at', { ascending: true })
        .limit(30);
      if (error) throw error;
      if (data) {
        setChatMessages(data.map((m: any) => ({
          id: m.id,
          content: m.content,
          sender_id: m.sender_id,
          created_at: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          sender_name: m.profiles?.full_name || 'Membre KoZons'
        })));
      }
    } catch (error) { console.error(error); }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !selectedImage || !session?.user) return;
    setLoading(true);

    try {
      let uploadedImageUrl = '';

      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('post-images').getPublicUrl(filePath);
        uploadedImageUrl = data.publicUrl;
      }

      await supabase.from('posts').insert([
        { 
          content: newPostContent.trim(), 
          user_id: session.user.id,
          image_url: uploadedImageUrl || null 
        }
      ]);

      setNewPostContent('');
      removeSelectedImage();
      await fetchPosts();
    } catch (error) { 
      console.error(error);
      alert('Erreur lors de la publication.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiveMessage.trim() || !session?.user) return;
    try {
      await supabase.from('messages').insert([{ content: newLiveMessage.trim(), sender_id: session.user.id }]);
      setNewLiveMessage('');
      fetchChatMessages();
    } catch (error) { console.error(error); }
  };

  const handleLike = async (postId: string, currentLikes: { user_id: string }[]) => {
    if (!session?.user) return;
    const userId = session.user.id;
    const hasLiked = currentLikes.some(like => like.user_id === userId);
    try {
      if (hasLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      else await supabase.from('likes').insert([{ post_id: postId, user_id: userId }]);
      await fetchPosts();
    } catch (error) { console.error(error); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        alert("Inscription réussie !");
      } else {
        await supabase.auth.signInWithPassword({ email, password });
      }
    } catch (error: any) { alert(error.message); }
  };

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-orange-100 w-full max-w-md border border-white flex flex-col items-center">
          <img src={logoImg} alt="KoZons" className="w-28 h-28 object-contain mb-4" />
          <h1 className="text-3xl font-black text-gray-800 mb-2">KoZons</h1>
          <p className="text-gray-400 text-sm text-center mb-8 px-4">Connectez-vous pour rejoindre la communauté KoZons.</p>
          <form onSubmit={handleAuth} className="space-y-4 w-full">
            {isSignUp && <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-400 text-sm" placeholder="Nom complet" />}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-400 text-sm" placeholder="Email" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-400 text-sm" placeholder="Mot de passe" />
            <button type="submit" className="w-full bg-[#FF8533] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 hover:scale-[1.02] transition-transform">{isSignUp ? "S'inscrire" : "Se connecter"}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-sm font-bold text-[#33CC33]">{isSignUp ? "Déjà un compte ? Connexion" : "Nouveau ? Créer un compte"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-gray-800 font-sans antialiased">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex justify-center pt-4 pb-2">
          <div className="flex items-center space-x-2">
            <img src={logoImg} alt="KoZons" className="w-8 h-8" />
            <span className="text-xl font-black bg-gradient-to-r from-[#FF8533] to-[#33CC33] bg-clip-text text-transparent">KoZons</span>
          </div>
        </div>
        <div className="max-w-md mx-auto flex justify-between px-4 pb-2 pt-1">
          <TabButton id="menu" icon={<Menu />} active={activeTab} color="#FF8533" onClick={setActiveTab} />
          <TabButton id="search" icon={<Search />} active={activeTab} color="#33CC33" onClick={setActiveTab} />
          <TabButton id="feed" icon={<Edit3 />} active={activeTab} color="#FF8533" onClick={setActiveTab} />
          <TabButton id="messages" icon={<Mail />} active={activeTab} color="#33CC33" onClick={setActiveTab} />
          <TabButton id="notifications" icon={<Bell />} active={activeTab} color="#FF8533" onClick={setActiveTab} />
          <TabButton id="profile" icon={<User />} active={activeTab} color="#33CC33" onClick={setActiveTab} />
        </div>
      </header>

      <main className="max-w-md mx-auto py-6 px-4 pb-20">
        
        {activeTab === 'feed' && (
          <>
            <div className="bg-white rounded-[2rem] shadow-sm p-5 mb-6 border border-gray-50">
              <form onSubmit={handlePublishPost}>
                <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="Exprimez-vous sur KoZons..." className="w-full resize-none text-sm border-none focus:ring-0 min-h-[60px] bg-transparent" />
                
                {imagePreview && (
                  <div className="relative mt-2 mb-4 rounded-2xl overflow-hidden group max-h-48 border">
                    <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                    <button type="button" onClick={removeSelectedImage} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center mt-2 border-t pt-3">
                  <label className="cursor-pointer p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-[#33CC33] transition-colors">
                    <Image className="w-5 h-5" />
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>

                  <button type="submit" disabled={loading || (!newPostContent.trim() && !selectedImage)} className="bg-[#FF8533] text-white px-6 py-2 rounded-xl text-xs font-bold shadow-md shadow-orange-100 disabled:opacity-50">
                    {loading ? 'Envoi...' : 'Publier'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-5">
              {posts.map((post) => {
                const liked = post.likes.some(l => l.user_id === session.user.id);
                return (
                  <article key={post.id} className="bg-white rounded-[2.5rem] shadow-sm p-6 border border-gray-50">
                    <div className="flex items-center space-x-3 mb-4">
                      <img src={post.user_avatar} className="w-11 h-11 rounded-full object-cover" />
                      <div>
                        <h3 className="font-bold text-sm">{post.user_name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{post.created_at}</p>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 text-sm leading-relaxed mb-4 px-1">{post.content}</p>
                    
                    {post.image_url && (
                      <div className="rounded-2xl overflow-hidden border border-gray-100 mb-4 bg-gray-50 max-h-64 flex items-center justify-center">
                        <img src={post.image_url} alt="Publication" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-50">
                      <button onClick={() => handleLike(post.id, post.likes)} className={`flex items-center space-x-2 ${liked ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                        <span className="text-xs">{post.likes.length}</span>
                      </button>
                      <button className="flex items-center space-x-2 text-gray-400">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-xs">{post.comments?.length || 0}</span>
                      </button>
                      <button className="text-gray-400"><Share2 className="w-5 h-5" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-50">
              <h2 className="font-black text-lg text-gray-800 mb-4">Espace KoZons</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50/50 p-4 rounded-3xl flex flex-col items-center text-center">
                  <Award className="text-[#FF8533] mb-2 w-6 h-6" />
                  <span className="text-xs font-bold text-gray-700">Badges Créateurs</span>
                </div>
                <div className="bg-green-50/50 p-4 rounded-3xl flex flex-col items-center text-center">
                  <Shield className="text-[#33CC33] mb-2 w-6 h-6" />
                  <span className="text-xs font-bold text-gray-700">Sécurité</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="bg-white rounded-[2rem] shadow-sm p-4 flex items-center space-x-3 border border-gray-50">
              <Search className="text-gray-400 w-5 h-5" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="w-full bg-transparent border-none text-sm focus:ring-0 outline-none" />
            </div>
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-50">
                  <span className="text-xs font-bold text-[#33CC33]">{post.user_name}</span>
                  <p className="text-gray-600 text-xs mt-1">{post.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white rounded-[2.5rem] p-4 shadow-sm border border-gray-50 flex flex-col h-[65vh]">
            <div className="border-b pb-3 mb-3 flex items-center space-x-2">
              <MessageSquare className="text-[#33CC33] w-5 h-5" />
              <span className="font-bold text-sm text-gray-700">Salon Communautaire</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMessages.map((msg) => {
                const isMe = msg.sender_id === session.user.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-gray-400 font-bold px-1 mb-0.5">{msg.sender_name}</span>
                    <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${isMe ? 'bg-[#33CC33] text-white rounded-tr-none' : 'bg-gray-100 text-gray-700 rounded-tl-none'}`}><p>{msg.content}</p></div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleSendChatMessage} className="mt-3 pt-3 border-t flex items-center space-x-2">
              <input type="text" value={newLiveMessage} onChange={(e) => setNewLiveMessage(e.target.value)} placeholder="Écrire un message..." className="w-full bg-gray-50 px-4 py-2.5 rounded-xl text-xs border-none" />
              <button type="submit" className="p-2.5 bg-[#33CC33] text-white rounded-xl"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        )}

        {activeTab === 'notifications' && <div className="text-center py-8 text-gray-400 text-xs">Aucune nouvelle notification.</div>}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-[2.5rem] p-8 text-center shadow-sm border border-gray-50">
             <div className="w-24 h-24 bg-green-50 text-[#33CC33] rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-black">{session.user.email[0].toUpperCase()}</div>
             <h2 className="font-black text-xl mb-1">Mon Profil</h2>
             <p className="text-gray-400 text-sm mb-8">{session.user.email}</p>
             <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-bold flex items-center justify-center space-x-2"><span>Déconnexion</span></button>
          </div>
        )}

      </main>
    </div>
  );
}

function TabButton({ id, icon, active, color, onClick }: any) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} className={`relative flex-1 flex justify-center py-2.5 mx-1 rounded-2xl transition-all duration-300 ${isActive ? 'scale-110 shadow-md' : ''}`} style={{ backgroundColor: isActive ? color : 'transparent' }}>
      <div className={`transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>{icon}</div>
    </button>
  );
}

export default App;