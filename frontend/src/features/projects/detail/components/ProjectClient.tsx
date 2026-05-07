import type { Client } from '@/features/clients/types.js'
import ProfilePictureFromName from '@/UiComponents/ProfilePictureFromName.js'
import React from 'react'

interface ProjectClientProps {
   client: Client | undefined
}

const ProjectClient: React.FC<ProjectClientProps> = ({ client }) => {
  return (
    <div className='border border-white/20 rounded-2xl px-4 py-4 flex items-center gap-2' >
      <ProfilePictureFromName name={client?.name!} scale={1.5} />
      <div className='flex flex-col' >
         <span className='dark:text-white/65 text-xs' >
            Client
         </span>
         <h2 className='text-2xl' >
            {client?.name}
         </h2>
         <p className='dark:text-white/65 text-sm' >
            {client?.email}{client?.phone ? ` | ${client.phone}` : ''}
         </p>
      </div>
    </div>
  )
}

export default ProjectClient
