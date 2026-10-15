// IMPORTS --------------------------------------------------------------------

import RoutePlanner from '@/components/viewer/RoutePlanner';
// borrows the 3D viewer and control pannel

// ----------------------------------------------------------------------------

export default function ViewerPage() {
    // page that next.js shows when viewwer is visited

    return (

        <main className="h-screen w-full"> 

        <RoutePlanner />

        </main>

    );
        
    }
