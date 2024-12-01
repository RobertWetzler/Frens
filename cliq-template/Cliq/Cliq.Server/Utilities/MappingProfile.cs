using AutoMapper;
using Cliq.Server.Models;

namespace Cliq.Server.Utilities;
// AutoMapper is used for mapping entity classes to DataTransfer Objects (DTOs) visible to user
public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Post, PostDto>();
        CreateMap<User, UserDto>();
    }
}
