import React from 'react'
import bgimg from '../assets/bg-img2.jpg'
import Navbar from '../components/layout/Navbar'
import dashboard from '../assets/dashboard.png'

const Hero = () => {
   return (
      <div className="relative w-screen h-screen overflow-hidden bg-black">
         <img
            src={bgimg}
            alt="Background"
            className="absolute top-0 left-0 w-full h-full object-cover opacity-50 select-none"
         />

         <div className='relative z-10' >
            <Navbar />
         </div>

         <div className="flex flex-col relative z-10 justify-center items-center mt-8">
            <div className='flex flex-col justify-center items-center w-1/2 gap-4' >
         
               <div className="bg-black/50 w-96 h-8 text-white"></div>
               <div className='text-white text-5xl text-center font-mono shadow-2xs bg-red'>
                  Invoice, Track, Get Paid - Built by freelancers, for freelancers
               </div>
               <div className='flex gap-2 mt-3'>
                  <button className='px-4 py-2 bg-white text-black rounded-full cursor-pointer'>Get Started</button>
                  <button className='px-4 py-2 border border-black bg-gray-700/50 text-white rounded-full cursor-pointer'>Learn more</button>
               </div>

            </div>
               <img src={dashboard} className="blur-[1.4px] border rounded-[100px] mt-12 opacity-85 select-none" />
            <div>

            </div>

         </div>
      </div>
   )
}

export default Hero
