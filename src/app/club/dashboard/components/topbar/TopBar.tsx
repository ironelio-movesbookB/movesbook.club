"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Settings, Menu, MessageSquare, User } from "lucide-react";

import useTopBarSettings from "./hooks/useTopBarSettings";
import { useChatUnreadCount } from "@/hooks/useChatUnreadCount";
import ChatUnreadBadge from "@/components/chat/ChatUnreadBadge";
import ClubAdminMenuDropdown from "@/components/club/topbar/ClubAdminMenuDropdown";
import { writeClubWorkspaceTab } from "@/lib/club/clubWorkspaceTab";

import CustomizeMenu from "./components/CustomizeMenu";
import GeneralSettingsMenu from "./components/GeneralSettingsMenu";
import SortingMenu from "./components/SortingMenu";
import CheckboxWindow from "./components/CheckboxWindow";
import HorizontalItemsBar from "./components/HorizontalItemsBar";
import ToastContainer from "./components/ToastContainer";
import HeaderBar from "./components/HeaderBar";

type TopBarProps = {
    onChatPanelClick?: () => void;
};

export default function TopBar({ onChatPanelClick }: TopBarProps) {
    const router = useRouter();

    const {
        menuData,
        activeSubMenu,
        checkedItems,
        showSettingsMenu,
        showSortingMenu,
        showGeneralSettingsMenu,
        showItems,
        checkboxWindowState,
        setCheckboxWindowState,
        toasts,
        toggleSettings,
        toggleGeneralSettings,
        openSubMenu,
        handleMainMenuItemClick,
        handleCheckboxChange,
        handleSave,
        handleCancel,
        handleReset,
        swapItem,
        removeToast,
        showHelpInfo,
        toggleHelpInfo,
    } = useTopBarSettings();

    const { unreadCount } = useChatUnreadCount();

    const itemsContainerRef = useRef<HTMLDivElement>(null);

    const scrollItems = (
        direction: "left" | "right"
    ) => {
        if (!itemsContainerRef.current) {
            return;
        }

        const container = itemsContainerRef.current;
        const scrollAmount = 200;

        if (direction === "left") {
            container.scrollLeft = Math.max(
                0,
                container.scrollLeft - scrollAmount
            );
        } else {
            const maxScroll =
                container.scrollWidth -
                container.clientWidth;

            container.scrollLeft = Math.min(
                maxScroll,
                container.scrollLeft + scrollAmount
            );
        }
    };

    const visibleItems =
        showItems
            ? menuData[showItems].items
            : [];

    return (
        <div className="relative w-full">
            {/* Main TopBar */}
            <div className="h-[44px] w-full bg-[#eeeeee] border-b border-gray-400 flex items-center justify-between px-3 z-10">
                {/* Left section */}
                <div className="flex items-center gap-2">
                    <button className="text-gray-600">
                        <Menu size={24} />
                    </button>
                    <button 
                        onClick={toggleHelpInfo}
                        className="h-[28px] px-3 bg-white border border-gray-300 rounded-sm text-[13px]"
                    >
                        ❓ Help Info
                    </button>
                    <button 
                        onClick={toggleGeneralSettings}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <Settings size={22} />
                    </button>
                    <ClubAdminMenuDropdown variant="insert" tone="dark" />
                    <ClubAdminMenuDropdown variant="archive" tone="light" />
                    <button
                        type="button"
                        onClick={() => {
                            writeClubWorkspaceTab('my-entity');
                            router.push('/club/member-overview');
                        }}
                        className="h-[28px] px-3 bg-white border border-gray-300 rounded-sm text-[13px] flex items-center gap-1 hover:bg-gray-50"
                    >
                        <User size={14} />
                        Member Overview
                    </button>
                </div>

                {/* Right section */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onChatPanelClick?.()}
                        className="h-[28px] px-3 bg-white border border-gray-300 rounded-sm text-[13px] font-medium text-gray-800 hover:bg-gray-100 flex items-center gap-2"
                    >
                        <MessageSquare size={14} />
                        Chat panel
                        <ChatUnreadBadge count={unreadCount} />
                    </button>

                    <button
                        onClick={() => handleMainMenuItemClick("newPosts")}
                        className="h-[28px] px-4 bg-black text-white rounded-sm text-[13px] hover:bg-gray-800"
                    >
                        New Post
                    </button>

                    <button
                        onClick={() => handleMainMenuItemClick("myPosts")}
                        className="h-[28px] px-4 bg-white border border-gray-300 rounded-sm text-[13px] hover:bg-gray-50"
                    >
                        My Posts
                    </button>

                    <div className="relative">
                        <button
                            onClick={toggleSettings}
                            className="h-[28px] w-[28px] bg-white border border-gray-300 rounded-full flex items-center justify-center"
                        >
                            <Settings size={16} className="text-gray-500" />
                        </button>

                        <CustomizeMenu
                            isOpen={showSettingsMenu}
                            onOpenSubMenu={openSubMenu}
                        />

                        <SortingMenu
                            isOpen={showSortingMenu}
                            activeSubMenu={activeSubMenu}
                            menuData={menuData}
                            checkedItems={checkedItems}
                            onCheckboxChange={handleCheckboxChange}
                            onSwapItem={swapItem}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onReset={handleReset}
                            onClose={handleCancel}
                        />
                    </div>
                </div>
            </div>

            {/* General Settings Menu (positioned absolutely) */}
            <GeneralSettingsMenu
                isOpen={showGeneralSettingsMenu}
            />

            {/* Checkbox Window Modal */}
            <CheckboxWindow
                isOpen={checkboxWindowState.isOpen}
                itemIndex={checkboxWindowState.itemIndex}
                activeSubMenu={activeSubMenu}
                menuData={menuData}
                checkedItems={checkedItems}
                onToggle={() => {
                    if (checkboxWindowState.itemIndex >= 0) {
                        handleCheckboxChange(
                            checkboxWindowState.itemIndex
                        );
                    }
                }}
                onClose={() => {
                    setCheckboxWindowState({
                        isOpen: false,
                        itemIndex: -1
                    });
                }}
                onToggleClose={() => {
                    if (checkboxWindowState.itemIndex >= 0) {
                        handleCheckboxChange(
                            checkboxWindowState.itemIndex
                        );
                    }
                    setCheckboxWindowState({
                        isOpen: false,
                        itemIndex: -1
                    });
                }}
            />

            {/* Horizontal Items Bar - appears when New Post or My Post is clicked */}
            <HorizontalItemsBar
                visible={!!showItems}
                items={visibleItems}
                onScroll={scrollItems}
                containerRef={itemsContainerRef}
            />

            {/* HeaderBar shown below HorizontalItemsBar when Help Info is clicked */}
            {showHelpInfo && (
                <HeaderBar
                    onHelpInfo={toggleHelpInfo}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer
                toasts={toasts}
                onRemove={removeToast}
            />
        </div>
    );
}