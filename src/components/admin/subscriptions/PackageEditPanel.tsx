'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PackageItemEditData } from '@/types/adminPackageSettings';
import {
  getPackageSettingsHref,
  PACKAGE_TYPE_CONFIGS,
  savePackageItemEditData,
} from '@/lib/admin/packageSettingsMock';
import RichTextEditor from '@/components/shared/RichTextEditor';
import SubscriptionSystemDashboardHeader from './SubscriptionSystemDashboardHeader';
import MovesbookLanguageGrid from './MovesbookLanguageGrid';

type PackageEditPanelProps = {
  initialData: PackageItemEditData;
};

export default function PackageEditPanel({ initialData }: PackageEditPanelProps) {
  const router = useRouter();
  const userTypeConfig = PACKAGE_TYPE_CONFIGS.find((c) => c.id === initialData.userTypeId)!;
  const [data, setData] = useState(initialData);
  const [editLang, setEditLang] = useState(initialData.lang);
  const [submitting, setSubmitting] = useState(false);
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const updateItem = (patch: Partial<PackageItemEditData['item']>) => {
    setData((prev) => ({ ...prev, item: { ...prev.item, ...patch } }));
  };

  const updateLangField = (
    field: 'titlesByLang' | 'descriptionsByLang' | 'htmlByLang',
    lang: string,
    value: string,
  ) => {
    setData((prev) => ({
      ...prev,
      item: {
        ...prev.item,
        [field]: { ...prev.item[field], [lang]: value },
      },
    }));
  };

  const toggleTier = (tierKey: string) => {
    const current = data.item.tiersByUserType[data.userTypeId] ?? {};
    setData((prev) => ({
      ...prev,
      item: {
        ...prev.item,
        tiersByUserType: {
          ...prev.item.tiersByUserType,
          [prev.userTypeId]: { ...current, [tierKey]: !current[tierKey] },
        },
      },
    }));
  };

  const handlePictureLoad = (index: 0 | 1 | 2, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const next = [...data.item.pictures] as [string, string, string];
      next[index] = String(reader.result ?? '');
      updateItem({ pictures: next });
    };
    reader.readAsDataURL(file);
  };

  const removePicture = (index: 0 | 1 | 2) => {
    const next = [...data.item.pictures] as [string, string, string];
    next[index] = '';
    updateItem({ pictures: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    savePackageItemEditData(data);
    await new Promise((r) => setTimeout(r, 300));
    setSubmitting(false);
    router.push(getPackageSettingsHref(data.userTypeId, data.lang));
  };

  const tiers = data.item.tiersByUserType[data.userTypeId] ?? {};

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <SubscriptionSystemDashboardHeader />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-white p-4 lg:p-6">
        <h2 className="text-center text-lg font-bold text-gray-800 mb-4">Edit Subscription</h2>

        <div className="border border-gray-300 mb-4 max-w-5xl mx-auto">
          <div className="bg-[#5bc0de] text-white px-4 py-2 font-bold text-sm">Package Info</div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-4">
              <MovesbookLanguageGrid activeLang={editLang} onChange={setEditLang} />

              <div>
                <label className="block text-sm text-gray-700 mb-1">Feature</label>
                <input
                  type="text"
                  value={data.item.titlesByLang[editLang] ?? ''}
                  onChange={(e) => updateLangField('titlesByLang', editLang, e.target.value)}
                  className="w-full border border-gray-300 bg-[#fffacd] px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea
                  value={data.item.descriptionsByLang[editLang] ?? ''}
                  onChange={(e) => updateLangField('descriptionsByLang', editLang, e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm resize-y"
                />
              </div>

              <div>
                <span className="block text-sm text-gray-700 mb-2">Status</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="status"
                      checked={data.item.published}
                      onChange={() => updateItem({ published: true })}
                    />
                    Publish
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="status"
                      checked={!data.item.published}
                      onChange={() => updateItem({ published: false })}
                    />
                    Unpublish
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {([0, 1, 2] as const).map((index) => (
                <div key={index} className="text-center">
                  <input
                    ref={fileRefs[index]}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePictureLoad(index, file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs[index].current?.click()}
                    className="bg-[#333] text-white px-4 py-1 text-xs font-bold mb-2"
                  >
                    Load Pic {index + 1}
                  </button>
                  <div className="relative mx-auto h-36 w-48 border border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {data.item.pictures[index] ? (
                      <>
                        <Image
                          src={data.item.pictures[index]}
                          alt={`Package picture ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => removePicture(index)}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d9534f] text-white"
                          aria-label={`Remove picture ${index + 1}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">No image</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-gray-300 mb-4 max-w-5xl mx-auto">
          <div className="bg-[#5bc0de] text-white px-4 py-2 font-bold text-sm">
            Full package overview
          </div>
          <div className="p-3">
            <MovesbookLanguageGrid activeLang={editLang} onChange={setEditLang} />
            <div className="mt-3">
              <RichTextEditor
                value={data.item.htmlByLang[editLang] ?? ''}
                onChange={(html) => updateLangField('htmlByLang', editLang, html)}
                minHeight="280px"
              />
            </div>
          </div>
        </div>

        <div className="border border-gray-300 mb-6 max-w-5xl mx-auto">
          <div className="bg-[#5bc0de] text-white px-4 py-2 font-bold text-sm">
            Activation of the package versions
          </div>
          <div className="p-4">
            <div className="bg-[#4a4a4a] text-white px-4 py-1.5 text-sm font-bold inline-block mb-4">
              {userTypeConfig.label}
            </div>
            <div className="flex flex-wrap gap-6">
              {userTypeConfig.tiers.map((tier) => (
                <label key={tier.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={tiers[tier.key] ?? false}
                    onChange={() => toggleTier(tier.key)}
                  />
                  {tier.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-3 pb-8">
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#d9534f] hover:bg-[#c9302c] text-white px-10 py-2 text-sm font-bold disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => router.push(getPackageSettingsHref(data.userTypeId, data.lang))}
            className="bg-[#777] hover:bg-[#555] text-white px-10 py-2 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
