using AutoMapper;
using Cliq.Server.Models;
using System.Runtime.InteropServices;

namespace Cliq.Server.Utilities;
// AutoMapper is used for mapping entity classes to DataTransfer Objects (DTOs) visible to user
public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Post, PostDto>()
            .ForMember(dest => dest.SharedWithCircles, opt => opt.MapFrom(src => 
                src.SharedWithCircles.Select(cp => new CirclePublicDto
                {
                    Id = cp.CircleId,
                    Name = cp.Circle.Name,
                    IsShared = cp.Circle.IsShared,
                    // Shows if author of post is user of the circle.
                    //IsOwner = cp.Circle.OwnerId == src.UserId
                })));        
        CreateMap<User, UserDto>();
        CreateMap<User, UserProfileDto>();
        CreateMap<Friendship, FriendshipDto>();
        CreateMap<Comment, CommentDto>()
            // We'll handle replies separately due to their recursive nature
            .ForMember(dest => dest.Replies, opt => opt.Ignore());
        CreateMap<Circle, CirclePublicDto>();
    }
}

public static class CliqMappingHelper
{
    public static IMapper CreateMapper()
    {
        return (new MapperConfiguration(c => c.AddProfile(new MappingProfile()))).CreateMapper();
    }
}