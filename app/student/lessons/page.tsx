"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, Video, Image as ImageIcon, File } from 'lucide-react';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

export default function StudentLessonsPage() {
  const router = useRouter();
  const { currentStudent } = useApp();
  const [student, setStudent] = useState<any | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent);
      return;
    }

    const stored = localStorage.getItem('currentStudent');
    if (stored) {
      try {
        setStudent(JSON.parse(stored));
      } catch {
        localStorage.removeItem('currentStudent');
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  }, [currentStudent, router]);

  useEffect(() => {
    if (!student) return;

    (async () => {
      try {
        const allMaterials = (await getDataForAdmin('system', 'materials')) || [];
        const normalizedStudentGroup = String(student.group || '').trim().toLowerCase();
        const studentMaterials = allMaterials
          .filter((m: any) => {
            if (!normalizedStudentGroup) return true;
            const materialGroup = String(m.group || '').trim().toLowerCase();
            return materialGroup === normalizedStudentGroup;
          })
          .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

        setMaterials(studentMaterials);
      } catch (error) {
        console.error('Error loading materials:', error);
      }
    })();
  }, [student]);

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
      case 'pdf': return 'from-red-500 to-red-600';
      case 'video': return 'from-purple-500 to-purple-600';
      case 'image': return 'from-green-500 to-green-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  if (!student) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/student')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900">My Lessons</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {materials.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No materials yet</h3>
            <p className="text-gray-600">Your teacher hasn't uploaded any materials for your group yet.</p>
          </div>
        ) : (
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
                  <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dateMaterials.map((material: any, index: number) => {
                    const rawType = (material.fileType || material.type || '').toLowerCase();
                    const type = ['pdf', 'video', 'image', 'text'].includes(rawType) ? rawType : 'file';
                    const typeLabelMap: Record<string, string> = {
                      pdf: 'PDF Document',
                      video: 'Video',
                      image: 'Image',
                      text: 'Text Document',
                      file: material.fileType || material.type || 'File'
                    };
                    const isVideo = type === 'video';

                    return (
                    <motion.div
                      key={material.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
                    >
                      <div className={`w-16 h-16 bg-gradient-to-br ${getColor(type)} rounded-2xl flex items-center justify-center mb-4 text-white`}>
                        {getIcon(type)}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{material.title}</h3>
                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-gray-600 capitalize">Type: {typeLabelMap[type]}</p>
                        {material.content && (
                          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2">
                            {material.content}
                          </p>
                        )}
                        {material.dueDate && (
                          <p className="text-sm text-orange-600 font-medium">
                            Due: {new Date(material.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {isVideo && material.fileUrl ? (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black/5">
                          <video
                            src={material.fileUrl}
                            controls
                            playsInline
                            width="100%"
                            className="w-full h-auto max-h-72 object-contain"
                            preload="metadata"
                          />
                        </div>
                      ) : (
                        <a
                          href={material.fileUrl || '#'}
                          download={material.title || 'material'}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </a>
                      )}
                    </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
