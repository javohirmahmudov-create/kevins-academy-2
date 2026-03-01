'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, FileText, Video, Image as ImageIcon, File, Trash2, Download } from 'lucide-react';
import { getMaterials, getGroups, addMaterial, Material, Group } from '@/lib/storage';
import { upload } from '@vercel/blob/client';
import { useApp } from '@/lib/app-context';

export default function MaterialsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [formData, setFormData] = useState<{
    title: string;
    type: 'pdf' | 'video' | 'image' | 'text';
    group: string;
    dueDate: string;
    content: string;
  }>({
    title: '',
    type: 'pdf',
    group: '',
    dueDate: '',
    content: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const allMaterials = await getMaterials();
      const sortedMaterials = (allMaterials || []).sort((a: any, b: any) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      setMaterials(sortedMaterials);
      setGroups(await getGroups());
    })();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-set title from filename if empty
      if (!formData.title) {
        setFormData({ ...formData, title: file.name });
      }
    }
  };

  const handleAddMaterial = async () => {
    if (!formData.title || !formData.group) {
      alert(t('fill_required_fields'));
      return;
    }

    if (!selectedFile) {
      alert(t('please_select_file'));
      return;
    }

    setUploading(true);

    try {
      const blob = await upload(selectedFile.name, selectedFile, {
        access: 'public',
        handleUploadUrl: '/api/materials/upload'
      });

      await addMaterial({
        title: formData.title,
        fileType: formData.type,
        group: formData.group,
        dueDate: formData.dueDate || null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin',
        fileUrl: blob.url,
        content: formData.content || null
      });

      // refresh list from storage (now backed by server)
      const allMaterials = await getMaterials();
      const sortedMaterials = (allMaterials || []).sort((a: any, b: any) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      setMaterials(sortedMaterials);
      setFormData({ title: '', type: 'pdf', group: '', dueDate: '', content: '' });
      setSelectedFile(null);
      setShowAddModal(false);
      setUploading(false);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`${t('error_uploading_file')}: ${error.message || error}`);
      setUploading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6" />;
      case 'video': return <Video className="w-6 h-6" />;
      case 'image': return <ImageIcon className="w-6 h-6" />;
      default: return <File className="w-6 h-6" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'pdf': return 'from-red-500 to-pink-600';
      case 'video': return 'from-purple-500 to-indigo-600';
      case 'image': return 'from-green-500 to-teal-600';
      default: return 'from-gray-500 to-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('materials_management')}</h1>
                <p className="text-sm text-gray-500">{t('upload_manage_materials')}</p>
              </div>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-teal-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>{t('upload_material')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {Object.entries(
            materials.reduce((acc: any, material: any) => {
              const date = material.uploadedAt;
              if (!acc[date]) acc[date] = [];
              acc[date].push(material);
              return acc;
            }, {})
          ).map(([date, dateMaterials]: [string, any]) => (
            <div key={date}>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dateMaterials.map((material: any, index: number) => (
                  <motion.div key={material.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className={`w-16 h-16 bg-gradient-to-br ${getColor(material.fileType || material.type)} rounded-2xl flex items-center justify-center mb-4 text-white`}>
                      {getIcon(material.fileType || material.type)}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{material.title}</h3>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-600">{t('group_label')}: {material.group}</p>
                      {material.content && (
                        <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2">
                          {material.content}
                        </p>
                      )}
                      {material.dueDate && (
                        <p className="text-sm text-orange-600 font-medium">
                          {t('due_date')}: {new Date(material.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {(material.fileType || material.type) === 'video' && material.fileUrl && (
                      <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-black/5">
                        <video
                          src={material.fileUrl}
                          controls
                          playsInline
                          width="100%"
                          className="w-full h-auto max-h-72 object-contain"
                          preload="metadata"
                        />
                      </div>
                    )}
                    <div className="flex space-x-2">
                      {(material.fileType || material.type) !== 'video' && material.fileUrl && (
                        <a
                          href={material.fileUrl}
                          download={material.title}
                          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                        >
                          <Download className="w-4 h-4" />
                          <span className="text-sm">{t('download')}</span>
                        </a>
                      )}
                      <button
                        onClick={async () => {
                          // call API to delete by id
                          await fetch(`/api/materials?id=${encodeURIComponent(material.id)}`, {
                            method: 'DELETE'
                          });
                          const allMaterials = await getMaterials();
                          const sortedMaterials = allMaterials.sort((a, b) =>
                            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
                          );
                          setMaterials(sortedMaterials);
                        }}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">{t('delete')}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('upload_material')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('file')} *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.avi,.mov,.mp3,.wav,.jpg,.jpeg,.png,.gif,.txt,.zip,.rar"
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <File className="w-12 h-12 text-gray-400 mb-2" />
                      {selectedFile ? (
                        <>
                          <p className="text-sm text-green-600 font-medium truncate max-w-xs">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600">
                            {formData.type === 'pdf' && t('click_upload_pdf')}
                            {formData.type === 'video' && t('click_upload_video')}
                            {formData.type === 'image' && t('click_upload_image')}
                            {formData.type === 'text' && t('click_upload_text')}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formData.type === 'pdf' && t('pdf_documents')}
                            {formData.type === 'video' && 'MP4, AVI, MOV'}
                            {formData.type === 'image' && 'JPG, PNG, GIF'}
                            {formData.type === 'text' && 'TXT, DOC, DOCX'}
                          </p>
                          <p className="text-xs text-green-600 mt-1">✓ {t('any_size_supported')}</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('title')} *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" placeholder={t('material_title')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('type')} *</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="pdf">{t('pdf_document')}</option>
                  <option value="video">{t('video')}</option>
                  <option value="image">{t('image')}</option>
                  <option value="text">{t('text')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('group')} *</label>
                <select value={formData.group} onChange={(e) => setFormData({ ...formData, group: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">{t('select_group')}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('due_date')} *</label>
                <input 
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">{t('deadline_for_students')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('comment_description')}</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  rows={3}
                  placeholder="Material haqida qisqacha izoh yozing"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedFile(null);
                  setFormData({ title: '', type: 'pdf', group: '', dueDate: '', content: '' });
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                disabled={uploading}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleAddMaterial} 
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50"
                disabled={uploading}
              >
                {uploading ? t('uploading') : t('upload')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
