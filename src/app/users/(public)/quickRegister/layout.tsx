import { Suspense } from 'react';
import QuickRegisterHeader from '@/components/users/QuickRegisterHeader';
import './quick-register.css';

export default function QuickRegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="quick-register-body">
      <div className="main martp-minus20">
        <Suspense fallback={null}>
          <QuickRegisterHeader />
        </Suspense>
        <div className="clear" />
        <div className="quick-register-content-area">{children}</div>
      </div>
    </div>
  );
}
