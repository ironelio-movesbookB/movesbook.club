'use client';

import { useState } from 'react';
import { Download, Grid, Palette, Settings, Star, Trophy } from 'lucide-react';
import BackgroundsColorsSettings from '@/components/settings/BackgroundsColorsSettings';
import ToolsSettings from '@/components/settings/ToolsSettings';
import FavouritesSettings from '@/components/settings/FavouritesSettings';
import MyBestSettings from '@/components/settings/MyBestSettings';
import GridDisplaySettings from '@/components/settings/GridDisplaySettings';

type SettingsTab = 'backgrounds' | 'tools' | 'favourites' | 'mybest' | 'grid';

type PersonalSettingsPanelProps = {
  user?: { language?: string; userType?: string } | null;
};

/**
 * Embedded Personal Settings panel used by Athlete and Club dashboards.
 * Matches the in-dashboard Personal Settings chrome (not the standalone /my-settings page).
 */
export default function PersonalSettingsPanel({ user }: PersonalSettingsPanelProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('backgrounds');
  const [loading, setLoading] = useState(false);
  const userLanguage = user?.language || 'en';

  const loadDefaultSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/settings/load-defaults?language=${userLanguage}`);
      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          const token = localStorage.getItem('token');
          if (token) {
            await fetch('/api/user/settings/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(data.settings),
            });
          }

          alert(`✅ Default settings for ${data.language.toUpperCase()} loaded and applied successfully!`);
        } else {
          alert('Failed to load default settings. Please try again.');
        }
      } else {
        alert('Failed to load default settings. Please try again.');
      }
    } catch (error) {
      console.error('Error loading default settings:', error);
      alert('Error loading default settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const settingsSections = [
    { id: 'backgrounds' as const, label: 'Backgrounds & Colors', icon: Palette },
    { id: 'tools' as const, label: 'Tools', icon: Settings },
    { id: 'favourites' as const, label: 'Favourites', icon: Star },
    { id: 'mybest' as const, label: 'My Best', icon: Trophy },
    { id: 'grid' as const, label: 'Grid Display Mode', icon: Grid },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border flex-1 flex flex-col overflow-hidden">
      <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings size={24} />
            <span>Personal Settings</span>
          </h2>
          <p className="text-sm text-gray-300 mt-1">
            Language: <span className="font-semibold">{userLanguage.toUpperCase()}</span> - Configure your
            personal preferences
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex-1">
          <p className="text-sm text-gray-800">
            <strong>Your Personal Settings</strong> - Configure your own preferences
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Optional: Load {userLanguage.toUpperCase()} defaults created by admins as a starting template
          </p>
        </div>
        <button
          onClick={loadDefaultSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download size={16} />
          <span>{loading ? 'Loading...' : 'Load Admin Defaults'}</span>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <nav className="p-4 space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSettingsTab(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeSettingsTab === section.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeSettingsTab === 'backgrounds' && <BackgroundsColorsSettings />}
          {activeSettingsTab === 'tools' && (
            <ToolsSettings isAdmin={false} userType={user?.userType || 'ATHLETE'} />
          )}
          {activeSettingsTab === 'favourites' && <FavouritesSettings />}
          {activeSettingsTab === 'mybest' && <MyBestSettings />}
          {activeSettingsTab === 'grid' && <GridDisplaySettings />}
        </div>
      </div>

      <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end flex-shrink-0">
        <p className="text-sm text-gray-600 italic">✓ All changes are saved automatically</p>
      </div>
    </div>
  );
}
