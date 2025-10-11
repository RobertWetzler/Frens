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
                    Name = cp.Circle != null ? cp.Circle.Name : string.Empty,
                    IsShared = cp.Circle != null ? cp.Circle.IsShared : false,
                })))
            .ForMember(dest => dest.HasImage, opt => opt.MapFrom(src => src.ImageObjectKeys.Any()))
            .ForMember(dest => dest.ImageCount, opt => opt.MapFrom(src => src.ImageObjectKeys.Count));        
        CreateMap<User, UserDto>();
        CreateMap<User, UserProfileDto>();
        CreateMap<Friendship, FriendshipDto>();
        CreateMap<Friendship, FriendRequestDto>();
        CreateMap<Comment, CommentDto>()
            // We'll handle replies separately due to their recursive nature
            .ForMember(dest => dest.Replies, opt => opt.Ignore());
        CreateMap<Circle, CirclePublicDto>();
        
        // CirclePost mapping
        // TODO THIS SHOULD NOT BE MAPPED
        CreateMap<CirclePost, CirclePublicDto>()
            .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.CircleId))
            .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Circle != null ? src.Circle.Name : string.Empty))
            .ForMember(dest => dest.IsShared, opt => opt.MapFrom(src => src.Circle != null ? src.Circle.IsShared : false));
        
        // Event mappings
        CreateMap<Event, EventDto>()
            .ForMember(dest => dest.GoingCount, opt => opt.Ignore())
            .ForMember(dest => dest.MaybeCount, opt => opt.Ignore())
            .ForMember(dest => dest.NotGoingCount, opt => opt.Ignore())
            .ForMember(dest => dest.CurrentUserRsvp, opt => opt.Ignore());
        CreateMap<EventRsvp, EventRsvpDto>();
    }
}

public static class CliqMappingHelper
{
    public static IMapper CreateMapper()
    {
        return (new MapperConfiguration(c => c.AddProfile(new MappingProfile()))).CreateMapper();
    }
}