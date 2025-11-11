import React from 'react'

const Navbar = () => {
   return (
      <div className='text-white z-50 flex justify-between items-center px-12 py-8' >

         <div className='text-2xl shadow-2xl h-full' >Freelancer Flow</div>

         <div className='bg-black/50 backdrop-blur-xs h-12 w-110 px-2 flex items-center justify-center rounded-full text-white/90' >
            <ul className='grid grid-cols-4 blur-none items-center h-full w-full justify-center rounded-full'>
               <li className='cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full' >Dashboard</li>
               <li className='cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full' >Features</li>
               <li className='cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full' >Contact</li>
               <li className='cursor-pointer h-full flex items-center justify-center hover:bg-white/5 rounded-full' >About</li>
            </ul>
         </div>

         <div className='flex gap-2 h-full' >
            <button className='px-4 py-2 border rounded-full hover:bg-white hover:text-black cursor-pointer' >Log In</button>
            <button className='px-4 py-2 bg-white text-black rounded-full cursor-pointer'>Sign Up</button>
         </div>

      </div>
   )
}

export default Navbar