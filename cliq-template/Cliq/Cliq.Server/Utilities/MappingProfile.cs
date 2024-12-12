using AutoMapper;
using Cliq.Server.Models;
using System.Runtime.InteropServices;

namespace Cliq.Server.Utilities;
// AutoMapper is used for mapping entity classes to DataTransfer Objects (DTOs) visible to user
public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Post, PostDto>();
        CreateMap<User, UserDto>();
        CreateMap<Comment, CommentDto>()
            // We'll handle replies separately due to their recursive nature
            .ForMember(dest => dest.Replies, opt => opt.Ignore());

    }
}

public static class CliqMappingHelper
{
    public static IMapper CreateMapper()
    {
        return (new MapperConfiguration(c => c.AddProfile(new MappingProfile()))).CreateMapper();
    }
}